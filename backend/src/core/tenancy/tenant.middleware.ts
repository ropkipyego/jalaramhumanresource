import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers['x-tenant'] as string | undefined;
    const tenant =
      header ??
      (req.body as { tenant?: string } | undefined)?.tenant ??
      process.env.DEFAULT_TENANT_CODE ??
      'jalaram';
    (req as Request & { tenant: string }).tenant = tenant;
    next();
  }
}
