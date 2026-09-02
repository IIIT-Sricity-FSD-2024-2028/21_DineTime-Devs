import { Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { NextFunction, Request, Response } from 'express';
import { Role } from 'src/common/enums/role.enum';
import { Logger } from 'winston';

@Injectable()
export class RoleCheckMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const roleHeader = req.header('role');
    const authorization = req.header('authorization');
    const requestId = req.header('x-request-id');

    if (authorization) {
      if (!authorization.startsWith('Bearer ') || authorization.trim() === 'Bearer') {
        this.audit('Malformed authorization header', req, requestId);
        throw new UnauthorizedException('Malformed authorization header');
      }

      next();
      return;
    }

    if (!roleHeader) {
      this.audit('Missing role header', req, requestId);
      throw new UnauthorizedException('Missing role header');
    }

    const normalizedRole = roleHeader.toLowerCase();
    if (!Object.values(Role).includes(normalizedRole as Role)) {
      this.audit('Invalid role header', req, requestId, roleHeader);
      throw new UnauthorizedException('Invalid role header');
    }

    req.headers.role = normalizedRole;
    next();
  }

  private audit(message: string, req: Request, requestId?: string, role?: string): void {
    this.logger.warn(message, {
      channel: 'security',
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      role,
      requestId,
    });
  }
}
