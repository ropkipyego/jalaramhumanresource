import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './core/auth/auth.module';
import { AuditModule } from './core/audit/audit.module';
import { TenancyModule } from './core/tenancy/tenancy.module';
import { TenantMiddleware } from './core/tenancy/tenant.middleware';
import { JwtAccessGuard } from './core/auth/auth.guards';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-jwt-secret-change-me-in-production',
      signOptions: {
        expiresIn: '8h',
        audience: 'authenticated',
      },
    }),
    DatabaseModule,
    TenancyModule,
    AuthModule,
    AuditModule,
    HealthModule,
    NotificationsModule,
    StorageModule,
    StaffModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAccessGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
