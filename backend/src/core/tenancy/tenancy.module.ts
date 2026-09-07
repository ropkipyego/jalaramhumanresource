import { Module } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';

@Module({})
export class TenancyModule {
  configure() {
    return TenantMiddleware;
  }
}
