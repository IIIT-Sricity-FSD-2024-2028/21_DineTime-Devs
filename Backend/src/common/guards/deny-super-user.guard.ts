import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { getActingRole } from 'src/common/utils/acting-role.util';

@Injectable()
export class DenySuperUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (getActingRole(request) === Role.SUPER_USER) {
      throw new ForbiddenException(
        'Payments and financial data are managed by the finance team, not the Super Admin',
      );
    }

    return true;
  }
}
