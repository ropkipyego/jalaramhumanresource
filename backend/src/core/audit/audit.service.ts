import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async record(input: {
    action: string;
    actorId?: string;
    actorEmail?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.db.query(
        `
        INSERT INTO public.audit_logs (user_id, action, table_name, new_data, ip_address)
        VALUES ($1::uuid, $2, 'platform', $3::jsonb, $4::inet)
        `,
        [
          input.actorId ?? null,
          input.action,
          JSON.stringify({ email: input.actorEmail, ...input.metadata }),
          input.ip ?? null,
        ],
      );
    } catch {
      await this.db.query(
        `
        INSERT INTO hr.audit_events (action, actor_id, actor_email, ip_address, metadata)
        VALUES ($1, $2::uuid, $3, $4, $5::jsonb)
        `,
        [
          input.action,
          input.actorId ?? null,
          input.actorEmail ?? null,
          input.ip ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
    }
  }
}
