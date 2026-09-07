import { Controller, Get } from '@nestjs/common';
import { Public } from '../core/auth/auth.decorators';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch (e) {
      return { status: 'degraded', database: 'down', error: String(e) };
    }
  }
}
