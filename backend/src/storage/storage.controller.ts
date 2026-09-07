import { Controller, Get } from '@nestjs/common';
import { Public } from '../core/auth/auth.decorators';

@Controller('storage')
export class StorageController {
  @Public()
  @Get('status')
  status() {
    return { provider: 'minio', ready: true };
  }
}
