import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { permissionsForRoles } from '../rbac/rbac.constants';
import { JwtUserPayload } from './auth.decorators';
import { AuditService } from '../audit/audit.service';

interface LegacyUserRow {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean | null;
  hr_status: string | null;
  must_change_password: boolean | null;
  roles: string[] | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async hasAuthSchema(): Promise<boolean> {
    const rows = await this.db.query<{ ok: number }>(
      `SELECT 1 AS ok FROM information_schema.schemata WHERE schema_name = 'auth' LIMIT 1`,
    );
    return rows.length > 0;
  }

  /** Validates against imported Supabase auth.users (pgcrypto crypt). */
  private async verifyLegacyPassword(email: string, password: string): Promise<LegacyUserRow | null> {
    const rows = await this.db.query<LegacyUserRow>(
      `
      SELECT u.id::text,
             u.email,
             p.full_name,
             p.is_active,
             p.hr_status::text,
             p.must_change_password,
             COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      WHERE lower(u.email) = lower($1)
        AND u.encrypted_password = crypt($2, u.encrypted_password)
      GROUP BY u.id, u.email, p.full_name, p.is_active, p.hr_status, p.must_change_password
      LIMIT 1
      `,
      [email, password],
    );
    return rows[0] ?? null;
  }

  /** Fallback when auth schema is missing — hr.app_credentials + profiles. */
  private async verifyAppCredentials(email: string, password: string): Promise<LegacyUserRow | null> {
    const rows = await this.db.query<LegacyUserRow & { password_hash: string }>(
      `
      SELECT p.id::text,
             p.email,
             p.full_name,
             p.is_active,
             p.hr_status::text,
             p.must_change_password,
             COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
             c.password_hash
      FROM public.profiles p
      JOIN hr.app_credentials c ON c.user_id = p.id
      LEFT JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE lower(p.email) = lower($1)
      GROUP BY p.id, p.email, p.full_name, p.is_active, p.hr_status, p.must_change_password, c.password_hash
      LIMIT 1
      `,
      [email],
    );
    const row = rows[0];
    if (!row) return null;
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return null;
    const { password_hash: _, ...user } = row;
    return user;
  }

  async login(email: string, password: string, tenant: string, ip?: string) {
    let user: LegacyUserRow | null = null;
    if (await this.hasAuthSchema()) {
      user = await this.verifyLegacyPassword(email, password);
    }
    if (!user) {
      user = await this.verifyAppCredentials(email, password);
    }

    if (!user) {
      await this.audit.record({
        action: 'auth.login_failed',
        actorEmail: email,
        ip,
        metadata: { tenant },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.is_active === false || user.hr_status === 'TERMINATED') {
      throw new UnauthorizedException('Account is inactive');
    }

    const roles = (user.roles ?? []).length ? user.roles! : ['STAFF'];
    const permissions = permissionsForRoles(roles);
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      tenant,
      roles,
      permissions,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id, tenant);

    await this.audit.record({
      action: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      ip,
      metadata: { tenant, roles },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        roles,
        permissions,
        mustChangePassword: user.must_change_password === true,
      },
    };
  }

  async me(userId: string) {
    const rows = await this.db.query<{
      id: string;
      email: string;
      full_name: string | null;
      staff_id: string | null;
      must_change_password: boolean | null;
      roles: string[] | null;
    }>(
      `
      SELECT p.id::text, p.email, p.full_name, p.staff_id, p.must_change_password,
             COALESCE(array_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
      FROM public.profiles p
      LEFT JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = $1::uuid
      GROUP BY p.id, p.email, p.full_name, p.staff_id, p.must_change_password
      `,
      [userId],
    );
    const row = rows[0];
    if (!row) throw new UnauthorizedException('User not found');
    const roles = (row.roles ?? []).length ? row.roles! : ['STAFF'];
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      staffId: row.staff_id,
      roles,
      permissions: permissionsForRoles(roles),
      mustChangePassword: row.must_change_password === true,
    };
  }

  private async createRefreshToken(userId: string, tenant: string) {
    const raw = randomBytes(48).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    await this.db.query(
      `
      INSERT INTO hr.refresh_tokens (user_id, token_hash, tenant_code, expires_at)
      VALUES ($1::uuid, $2, $3, now() + interval '7 days')
      `,
      [userId, hash, tenant],
    );
    return raw;
  }

  async refresh(rawToken: string) {
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const rows = await this.db.query<{ user_id: string; tenant_code: string }>(
      `
      SELECT user_id::text, tenant_code
      FROM hr.refresh_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
      LIMIT 1
      `,
      [hash],
    );
    const row = rows[0];
    if (!row) throw new UnauthorizedException('Invalid refresh token');

    const profile = await this.me(row.user_id);
    const payload: JwtUserPayload = {
      sub: profile.id,
      email: profile.email,
      role: 'authenticated',
      tenant: row.tenant_code,
      roles: profile.roles,
      permissions: profile.permissions,
    };
    const accessToken = this.jwt.sign(payload);
    return { accessToken, user: profile };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return { ok: true };
    const hash = createHash('sha256').update(rawToken).digest('hex');
    await this.db.query(
      `UPDATE hr.refresh_tokens SET revoked_at = now() WHERE token_hash = $1`,
      [hash],
    );
    return { ok: true };
  }

  async changePassword(userId: string, newPassword: string, currentPassword?: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new BadRequestException('Use upper, lower, and a number');
    }

    const rows = await this.db.query<{
      email: string;
      must_change_password: boolean | null;
    }>(
      `SELECT email, must_change_password FROM public.profiles WHERE id = $1::uuid`,
      [userId],
    );
    const profile = rows[0];
    if (!profile) throw new UnauthorizedException('User not found');

    const mustChange = profile.must_change_password === true;
    if (!mustChange) {
      if (!currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const verified = await this.verifyAppCredentials(profile.email, currentPassword);
      if (!verified) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.db.query(
      `
      INSERT INTO hr.app_credentials (user_id, password_hash, updated_at)
      VALUES ($1::uuid, $2, now())
      ON CONFLICT (user_id) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            updated_at = now()
      `,
      [userId, hash],
    );

    if (await this.hasAuthSchema()) {
      await this.db.query(
        `UPDATE auth.users SET encrypted_password = crypt($2, gen_salt('bf')) WHERE id = $1::uuid`,
        [userId, newPassword],
      );
    }

    await this.db.query(
      `UPDATE public.profiles SET must_change_password = false WHERE id = $1::uuid`,
      [userId],
    );

    return { ok: true };
  }
}
