import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { getActingRole } from 'src/common/utils/acting-role.util';

@Injectable()
export class ReadOnlyForSuperUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (getActingRole(request) === Role.SUPER_USER) {
      throw new ForbiddenException(
        'The Super Admin has read-only access to users, restaurants, and reservations',
      );
    }

    return true;
  }
}
