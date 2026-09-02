import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import { generateId } from 'src/common/utils/id.util';
import { CreateUserDto, UpdateUserDto } from 'src/modules/users/dto/users.dto';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  findAll(actingRole?: Role) {
    return this.userRepository.findAll().map((user) => this.enrichUser(user, actingRole));
  }

  findOne(id: string, actingRole?: Role) {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.enrichUser(user, actingRole);
  }

  private enrichUser(user: any, actingRole?: Role) {
    if (!user) {
      return user;
    }

    let enriched = user;

    if (user.role === Role.MANAGER) {
      const details = this.userRepository.getManagerDetails(user.id);
      enriched = {
        ...user,
        business_license_number: details?.business_license_number || '',
        verification_status: details?.verification_status || 'pending',
        verification_document_url: details?.verification_document_url || '',
        rejection_reason: details?.rejection_reason || '',
      };
    }

    if (user.role === Role.STAFF) {
      const details = this.userRepository.getStaffDetails(user.id);
      enriched = {
        ...user,
        restaurant_id: details?.restaurant_id || '',
        employee_code: details?.employee_code || '',
        role_type: details?.role_type || '',
      };
    }

    if (actingRole === Role.SUPER_USER) {
      const { phone, verification_document_url, ...redacted } = enriched;
      return redacted;
    }

    return enriched;
  }

  private nextSequence(prefix: string) {
    const users = this.userRepository.findAll();
    const used = users
      .map((user) => user.id)
      .filter((id) => id.startsWith(`${prefix}-`))
      .map((id) => {
        const part = id.split('-').pop() || '0';
        const parsed = Number(part.replace(/\D/g, ''));
        return Number.isNaN(parsed) ? 0 : parsed;
      });

    const max = used.length ? Math.max(...used) : 0;
    return String(max + 1).padStart(4, '0');
  }

  private buildUserId(dto: CreateUserDto) {
    if (dto.role === Role.DINER) {
      return `din-${this.nextSequence('din')}`;
    }

    if (dto.role === Role.MANAGER) {
      return `rm-${this.nextSequence('rm')}`;
    }

    if (dto.role === Role.SUPER_USER) {
      return `sup-${this.nextSequence('sup')}`;
    }

    return `rst-${this.nextSequence('rst')}`;
  }

  async create(dto: CreateUserDto) {
    const existing = this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const user = this.userRepository.create({
      id: this.buildUserId(dto),
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password_hash: await hash(dto.password_hash, 10),
      role: dto.role,
      status: dto.status ?? 'active',
      created_at: new Date().toISOString(),
      location_id: dto.location_id,
      photo_url: dto.photo_url,
    });

    if (dto.role === Role.DINER) {
      this.userRepository.upsertDinerDetails({
        diner_id: user.id,
        loyalty_points: 0,
      });
    }

    if (dto.role === Role.MANAGER) {
      this.userRepository.upsertManagerDetails({
        manager_id: user.id,
        business_license_number: dto.business_license_number ?? '',
        verification_status: 'pending',
      });
    }

    if (dto.role === Role.STAFF) {
      this.userRepository.upsertStaffDetails({
        staff_id: user.id,
        restaurant_id: dto.restaurant_id ?? '',
        employee_code: dto.employee_code ?? '',
        role_type: dto.role_type ?? '',
      });
    }

    const defaultSettings = this.settingsRepository.findSettingsByRole(dto.role);
    defaultSettings.forEach((setting) => {
      this.settingsRepository.createUserSetting({
        id: generateId('user_setting'),
        user_id: user.id,
        setting_id: setting.id,
        value: true,
      });
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const payload = { ...dto };
    if (payload.password_hash) {
      payload.password_hash = await hash(payload.password_hash, 10);
    }

    const updated = this.userRepository.update(id, payload);
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    if (updated.role === Role.MANAGER) {
      const current = this.userRepository.getManagerDetails(id);
      this.userRepository.upsertManagerDetails({
        manager_id: id,
        business_license_number:
          dto.business_license_number ?? current?.business_license_number ?? '',
        verification_status: current?.verification_status ?? 'pending',
        verification_document_url: current?.verification_document_url,
        rejection_reason: current?.rejection_reason,
        reviewed_by: current?.reviewed_by,
        reviewed_at: current?.reviewed_at,
      });
    }

    if (updated.role === Role.STAFF) {
      const current = this.userRepository.getStaffDetails(id);
      this.userRepository.upsertStaffDetails({
        staff_id: id,
        restaurant_id: dto.restaurant_id ?? current?.restaurant_id ?? '',
        employee_code: dto.employee_code ?? current?.employee_code ?? '',
        role_type: dto.role_type ?? current?.role_type ?? '',
      });
    }

    return this.enrichUser(updated);
  }

  uploadPhoto(id: string, photoUrl: string) {
    const updated = this.userRepository.update(id, { photo_url: photoUrl });
    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return this.enrichUser(updated);
  }

  remove(id: string) {
    const deleted = this.userRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException('User not found');
    }

    return { deleted: true };
  }
}
