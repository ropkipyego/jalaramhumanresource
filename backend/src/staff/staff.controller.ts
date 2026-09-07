import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { StaffService } from './staff.service';
import { JwtUserPayload, RequirePermissions } from '../core/auth/auth.decorators';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  @IsString()
  staffId!: string;

  @IsEnum(['STAFF', 'HEAD', 'ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'])
  role!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post('invite')
  @RequirePermissions('users:manage')
  invite(@Body() dto: InviteStaffDto, @Req() req: Request & { user: JwtUserPayload }) {
    return this.staff.invite(dto, req.user);
  }
}
