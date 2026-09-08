import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtUserPayload, Public } from '../core/auth/auth.decorators';
import { StorageService } from './storage.service';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN']);
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('status')
  status() {
    return {
      provider: 'minio',
      bucket: this.storage.getBucket(),
      ready: true,
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async upload(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body('path') path: string,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.uploadToPath(path, file, req.user);
  }

  @Get('download')
  async download(
    @Query('path') path: string,
    @Req() req: Request & { user: JwtUserPayload },
    @Res() res: Response,
  ) {
    this.validatePath(path);
    this.assertPathAccess(req.user, path);

    const { stream, contentType } = await this.storage.getObject(path);
    const fileName = path.split('/').pop() || 'document';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    stream.pipe(res);
  }

  @Delete('delete')
  async remove(
    @Query('path') path: string,
    @Req() req: Request & { user: JwtUserPayload },
  ) {
    this.validatePath(path);
    this.assertPathAccess(req.user, path);
    return this.storage.deleteObject(path);
  }

  private uploadToPath(
    path: string,
    file: UploadedFilePayload,
    user: JwtUserPayload,
  ) {
    this.validatePath(path);
    this.assertPathAccess(user, path);
    const contentType = file.mimetype || 'application/octet-stream';
    return this.storage.putObject(path, file.buffer, contentType);
  }

  private validatePath(path: string) {
    if (!path?.trim()) {
      throw new BadRequestException('path is required');
    }
    if (path.includes('..')) {
      throw new BadRequestException('Invalid path');
    }
  }

  private assertPathAccess(user: JwtUserPayload, path: string) {
    const ownerId = path.split('/')[0]?.trim();
    if (!ownerId) throw new BadRequestException('Invalid path');
    if (ownerId === user.sub) return;
    const roles = user.roles ?? [];
    if (roles.some((r) => ADMIN_ROLES.has(r))) return;
    throw new ForbiddenException('Cannot access files for another employee');
  }
}
