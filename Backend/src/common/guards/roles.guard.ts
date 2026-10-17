import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly users: UserRepository) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const path = req.path.replace(/\/$/,'');
    const registration = req.method === 'POST' && ['/auth/login','/sub-admin/login','/super-admin/login','/managers/register','/users'].includes(path);
    const catalog = req.method === 'GET' && /^(\/(restaurants|tables|timeslots|tableslots|menu|reviews))(\/[^/]+)?$/.test(path) && !path.endsWith('/revenue');
    const publicLocations = req.method === 'GET' && path.startsWith('/restaurants/locations');
    const publicVerificationTeams = req.method === 'GET' && path === '/verification/teams';
    const authorization = req.headers.authorization;
    let role: Role;
    if (authorization && !['/auth/login','/sub-admin/login'].includes(path)) {
      if (!authorization.startsWith('Bearer ')) throw new UnauthorizedException('Invalid authorization.');
      let payload: {sub:string;role:Role};
      try { payload = this.jwt.verify(authorization.slice(7)); } catch { throw new UnauthorizedException('Invalid or expired token'); }
      const account = this.users.findById(payload.sub);
      if (!account || account.role !== payload.role || account.status !== 'active') throw new UnauthorizedException('Your account is no longer active.');
      req.user = { sub:account.id, role:account.role }; role = account.role;
    } else if (registration || catalog || publicLocations || publicVerificationTeams) {
      role = Role.DINER;
      req.user = { role, anonymous: true };
      if (path === '/users' && req.method === 'POST') return true;
    } else throw new UnauthorizedException('Please sign in to continue.');
    if (registration || publicLocations || publicVerificationTeams) return true;
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY,[context.getHandler(),context.getClass()]);
    if (!required?.length || role === Role.SUPER_USER || required.includes(role)) return true;
    throw new ForbiddenException('Your account cannot perform this action.');
  }
}
