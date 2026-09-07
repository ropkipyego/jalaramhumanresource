import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { JwtUserPayload } from '../core/auth/auth.decorators';

const EMAIL_DOMAIN = 'jalaram.co.ke';

interface InviteDto {
  email: string;
  password: string;
  fullName: string;
  staffId: string;
  role: string;
  departmentId?: string;
}

@Injectable()
export class StaffService {
  constructor(private readonly db: DatabaseService) {}

  async invite(dto: InviteDto, caller: JwtUserPayload) {
    const email = dto.email.toLowerCase().trim();
    if (!email.endsWith(`@${EMAIL_DOMAIN}`)) {
      throw new BadRequestException(`Email must use @${EMAIL_DOMAIN}`);
    }

    const callerRoles = caller.roles ?? [];
    const allowed =
      callerRoles.includes('SUPER_ADMIN')
        ? new Set(['STAFF', 'HEAD', 'ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'])
        : new Set(['STAFF', 'HEAD', 'ADMIN']);
    if (!allowed.has(dto.role)) {
      throw new ForbiddenException(`Role "${dto.role}" is not allowed for your account`);
    }

    const dup = await this.db.query<{ id: string }>(
      `SELECT id::text FROM public.profiles WHERE lower(email) = $1 OR staff_id = $2 LIMIT 1`,
      [email, dto.staffId.trim()],
    );
    if (dup[0]) throw new BadRequestException('Email or Staff ID already in use');

    const userId = randomUUID();
    const meta = JSON.stringify({ full_name: dto.fullName, staff_id: dto.staffId.trim() });

    await this.db.query(
      `
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', $1::uuid, 'authenticated', 'authenticated', $2,
        crypt($3, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, now(), now()
      )
      `,
      [userId, email, dto.password, meta],
    );

    try {
      await this.db.query(
        `
        INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
        VALUES ($1::uuid, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2), 'email', $1::text, now(), now(), now())
        `,
        [userId, email],
      );
    } catch {
      /* identities table shape varies by dump version */
    }

    await this.db.query(
      `
      INSERT INTO public.profiles (id, email, full_name, staff_id, must_change_password, is_active, hr_status)
      VALUES ($1::uuid, $2, $3, $4, true, true, 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, staff_id = EXCLUDED.staff_id
      `,
      [userId, email, dto.fullName, dto.staffId.trim()],
    );

    await this.db.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1::uuid, $2::public.app_role) ON CONFLICT DO NOTHING`,
      [userId, dto.role],
    );

    if (dto.departmentId) {
      await this.db.query(
        `INSERT INTO public.employee_departments (employee_id, department_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
        [userId, dto.departmentId],
      );
    }

    return { success: true, userId, email };
  }
}
