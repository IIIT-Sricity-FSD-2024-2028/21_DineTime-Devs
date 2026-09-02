import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import {
  CreateSubAdminDto,
  SubAdminLoginDto,
  SubAdminTeam,
  UpdateSubAdminDto,
} from 'src/modules/sub-admin/dto/sub-admin.dto';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { UserRepository } from 'src/repositories/user.repository';

const TEAM_ROLE_MAP: Record<SubAdminTeam, Role> = {
  support: Role.SUPPORT_ADMIN,
  finance: Role.FINANCE_ADMIN,
  verification: Role.VERIFICATION_ADMIN,
};

const TEAM_PREFIX_MAP: Record<SubAdminTeam, string> = {
  support: 'spt',
  finance: 'fin',
  verification: 'ver',
};

const ADMIN_ROLES = [Role.SUPPORT_ADMIN, Role.FINANCE_ADMIN, Role.VERIFICATION_ADMIN];

const roleToTeam = (role: Role): SubAdminTeam | undefined =>
  (Object.keys(TEAM_ROLE_MAP) as SubAdminTeam[]).find((team) => TEAM_ROLE_MAP[team] === role);

@Injectable()
export class SubAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: SubAdminLoginDto) {
    const expectedRole = TEAM_ROLE_MAP[dto.team];
    const user = this.userRepository.findByEmail(dto.email.toLowerCase());

    if (!user || user.role !== expectedRole) {
      throw new UnauthorizedException('Invalid sub-admin credentials');
    }

    if (!(await compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid sub-admin credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Sub-admin account is inactive');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: dto.team,
      status: user.status,
      location_id: user.location_id,
      access_token: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }

  private nextSubAdminSequence(prefix: string) {
    const used = this.userRepository
      .findAll()
      .map((user) => user.id)
      .filter((id) => id.startsWith(`${prefix}-`))
      .map((id) => {
        const parsed = Number(id.split('-').pop()?.replace(/\D/g, ''));
        return Number.isNaN(parsed) ? 0 : parsed;
      });

    const max = used.length ? Math.max(...used) : 0;
    return String(max + 1).padStart(4, '0');
  }

  async create(dto: CreateSubAdminDto) {
    const existing = this.userRepository.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    let locationId: string | undefined;
    if (dto.team === 'verification') {
      if (!dto.location_id) {
        throw new BadRequestException('A location must be assigned to a Verification Team account');
      }
      if (!this.restaurantRepository.findLocationById(dto.location_id)) {
        throw new BadRequestException('Selected location does not exist');
      }
      locationId = dto.location_id;
    }

    const role = TEAM_ROLE_MAP[dto.team];
    const prefix = TEAM_PREFIX_MAP[dto.team];
    const user = this.userRepository.create({
      id: `${prefix}-${this.nextSubAdminSequence(prefix)}`,
      name: dto.name,
      email: dto.email.toLowerCase(),
      password_hash: await hash(dto.password, 10),
      role,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: locationId,
    });

    return { ...user, team: dto.team };
  }

  findAll(team?: SubAdminTeam) {
    const roles = team ? [TEAM_ROLE_MAP[team]] : ADMIN_ROLES;
    return this.userRepository
      .findAll()
      .filter((user) => roles.includes(user.role))
      .map((user) => ({ ...user, team: roleToTeam(user.role) }));
  }

  private findAdminOrThrow(id: string) {
    const user = this.userRepository.findById(id);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      throw new NotFoundException('Sub-admin not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateSubAdminDto) {
    const admin = this.findAdminOrThrow(id);

    const payload: Record<string, unknown> = {};
    if (dto.name) payload.name = dto.name;
    if (dto.email) payload.email = dto.email.toLowerCase();
    if (dto.status) payload.status = dto.status;
    if (dto.password) payload.password_hash = await hash(dto.password, 10);
    if (dto.location_id) {
      if (admin.role !== Role.VERIFICATION_ADMIN) {
        throw new BadRequestException('Only Verification Team accounts can have a location assigned');
      }
      if (!this.restaurantRepository.findLocationById(dto.location_id)) {
        throw new BadRequestException('Selected location does not exist');
      }
      payload.location_id = dto.location_id;
    }

    const updated = this.userRepository.update(id, payload);
    return { ...updated, team: roleToTeam(updated!.role) };
  }

  remove(id: string) {
    this.findAdminOrThrow(id);
    this.userRepository.remove(id);
    return { deleted: true };
  }
}
