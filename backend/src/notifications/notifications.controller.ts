import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { JwtUserPayload } from '../core/auth/auth.decorators';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(@Req() req: Request & { user: JwtUserPayload }) {
    const rows = await this.db.query(
      `
      SELECT id, type, title, body, link, read, created_at
      FROM public.notifications
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [req.user.sub],
    );
    return rows;
  }
}
