import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = this.getRoleFromRequest(request);

    if (!role) {
      throw new ForbiddenException('Missing role header');
    }

    if (role === Role.SUPER_USER) {
      return true;
    }

    if (!requiredRoles.includes(role as Role)) {
      throw new ForbiddenException('Role is not allowed for this resource');
    }

    return true;
  }

  private getRoleFromRequest(request: { headers: Record<string, string | string[] | undefined>; user?: unknown }): Role | undefined {
    const authorization = request.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (token) {
      try {
        const payload = this.jwtService.verify<{ role?: Role }>(token);
        request.user = payload;
        return payload.role;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    const roleHeader = request.headers.role;
    const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
    return role?.toLowerCase() as Role | undefined;
  }
}
