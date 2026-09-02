import { Role } from 'src/common/enums/role.enum';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  user?: { role?: Role };
}

export const getActingRole = (request: RequestLike): Role | undefined => {
  if (request.user?.role) {
    return request.user.role;
  }

  const roleHeader = request.headers.role;
  const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  return role as Role | undefined;
};
