import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, ChangePasswordDto } from './auth.dto';
import { Public, JwtUserPayload } from './auth.decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const tenant = dto.tenant ?? process.env.DEFAULT_TENANT_CODE ?? 'jalaram';
    return this.auth.login(
      dto.email,
      dto.password,
      tenant,
      req.ip,
    );
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() body: { refreshToken?: string }) {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  me(@Req() req: Request & { user: JwtUserPayload }) {
    return this.auth.me(req.user.sub);
  }

  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    return this.auth.changePassword(req.user.sub, dto.newPassword, dto.currentPassword);
  }
}
