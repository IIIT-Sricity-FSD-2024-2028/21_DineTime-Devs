import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
@Injectable()
export class RoleCheckMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const authorization = req.header('authorization');
    if (authorization && (!authorization.startsWith('Bearer ') || !authorization.slice(7).trim())) throw new UnauthorizedException('Malformed authorization header');
    next();
  }
}
