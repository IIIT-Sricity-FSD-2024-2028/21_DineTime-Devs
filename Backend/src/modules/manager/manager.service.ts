import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcrypt';
import {
  DEFAULT_CANCELLATION_CUTOFF_MINUTES,
  DEFAULT_NO_SHOW_GRACE_MINUTES,
  DEFAULT_RESERVATION_FEE_PER_GUEST,
} from 'src/common/config/billing.config';
import { Role } from 'src/common/enums/role.enum';
import { generateId } from 'src/common/utils/id.util';
import { ManagerVerificationStatus } from 'src/common/types/schema.types';
import {
  CreateManagerDetailsDto,
  RegisterManagerDto,
  ReviewManagerDto,
  UpdateManagerDetailsDto,
} from 'src/modules/manager/dto/manager.dto';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class ManagerService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  findOne(id: string) {
    const user = this.userRepository.findById(id);
    if (!user || user.role !== 'manager') {
      throw new NotFoundException('Manager not found');
    }
    const details = this.userRepository.getManagerDetails(id);
    return { ...user, ...details };
  }

  create(dto: CreateManagerDetailsDto) {
    return this.userRepository.upsertManagerDetails({
      manager_id: dto.manager_id,
      business_license_number: dto.business_license_number,
      verification_status: 'pending',
    });
  }

  update(id: string, dto: UpdateManagerDetailsDto) {
    const existing = this.userRepository.getManagerDetails(id);
    if (!existing) {
      throw new NotFoundException('Manager details not found');
    }

    return this.userRepository.upsertManagerDetails({
      ...existing,
      business_license_number:
        dto.business_license_number ?? existing.business_license_number,
    });
  }

  private nextManagerSequence() {
    const used = this.userRepository
      .findAll()
      .map((user) => user.id)
      .filter((id) => id.startsWith('rm-'))
      .map((id) => {
        const parsed = Number(id.split('-').pop()?.replace(/\D/g, ''));
        return Number.isNaN(parsed) ? 0 : parsed;
      });

    const max = used.length ? Math.max(...used) : 0;
    return String(max + 1).padStart(4, '0');
  }

  async register(dto: RegisterManagerDto, documentUrl: string) {
    const existingUser = this.userRepository.findByEmail(dto.email.toLowerCase());
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const location = this.restaurantRepository.findLocationById(dto.location_id);
    if (!location) {
      throw new BadRequestException('Selected location does not exist');
    }

    const duplicateRestaurant = this.restaurantRepository
      .findAll()
      .find(
        (restaurant) =>
          restaurant.location_id === dto.location_id &&
          restaurant.name.trim().toLowerCase() === dto.restaurant_name.trim().toLowerCase(),
      );
    if (duplicateRestaurant) {
      throw new BadRequestException('A restaurant with this name already exists at this location');
    }

    const managerId = `rm-${this.nextManagerSequence()}`;

    const manager = this.userRepository.create({
      id: managerId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      password_hash: await hash(dto.password, 10),
      role: Role.MANAGER,
      status: 'active',
      created_at: new Date().toISOString(),
      location_id: dto.location_id,
    });

    this.userRepository.upsertManagerDetails({
      manager_id: managerId,
      business_license_number: dto.business_license_number,
      verification_document_url: documentUrl,
      verification_status: 'pending',
    });

    const restaurant = this.restaurantRepository.create({
      id: generateId('restaurant'),
      manager_id: managerId,
      location_id: dto.location_id,
      name: dto.restaurant_name,
      cuisine_type: dto.cuisine_type,
      description: dto.description,
      total_tables: 0,
      rating_avg: 0,
      total_reviews: 0,
      status: 'active',
      is_open: false,
      created_at: new Date().toISOString(),
      image_urls: [],
      reservation_fee_per_guest: DEFAULT_RESERVATION_FEE_PER_GUEST,
      cancellation_cutoff_minutes: DEFAULT_CANCELLATION_CUTOFF_MINUTES,
      no_show_grace_minutes: DEFAULT_NO_SHOW_GRACE_MINUTES,
      opens_at: '11:00',
      closes_at: '23:00',
    });

    const defaultSettings = this.settingsRepository.findSettingsByRole(Role.MANAGER);
    defaultSettings.forEach((setting) => {
      this.settingsRepository.createUserSetting({
        id: generateId('user_setting'),
        user_id: managerId,
        setting_id: setting.id,
        value: true,
      });
    });

    return { manager, restaurant };
  }

  findApplications(locationId?: string, status?: ManagerVerificationStatus) {
    const managers = this.userRepository.findAll().filter((user) => user.role === Role.MANAGER);

    return managers
      .map((manager) => {
        const details = this.userRepository.getManagerDetails(manager.id);
        const restaurant = this.restaurantRepository.findByManagerId(manager.id)[0];
        return { manager, details, restaurant };
      })
      .filter((item): item is typeof item & { details: NonNullable<typeof item.details> } => Boolean(item.details))
      .filter((item) => !status || item.details.verification_status === status)
      .filter((item) => !locationId || item.restaurant?.location_id === locationId)
      .sort((a, b) => b.manager.created_at.localeCompare(a.manager.created_at));
  }

  findApplicationDetail(managerId: string) {
    const manager = this.userRepository.findById(managerId);
    if (!manager || manager.role !== Role.MANAGER) {
      throw new NotFoundException('Manager not found');
    }

    const details = this.userRepository.getManagerDetails(managerId);
    if (!details) {
      throw new NotFoundException('Manager verification details not found');
    }

    const restaurant = this.restaurantRepository.findByManagerId(managerId)[0];
    return { manager, details, restaurant };
  }

  review(managerId: string, dto: ReviewManagerDto) {
    const manager = this.userRepository.findById(managerId);
    if (!manager || manager.role !== Role.MANAGER) {
      throw new NotFoundException('Manager not found');
    }

    const details = this.userRepository.getManagerDetails(managerId);
    if (!details) {
      throw new NotFoundException('Manager verification details not found');
    }

    if (details.verification_status !== 'pending') {
      throw new BadRequestException('This application has already been reviewed');
    }

    return this.userRepository.upsertManagerDetails({
      ...details,
      verification_status: dto.decision,
      rejection_reason: dto.decision === 'rejected' ? (dto.reason || 'Not specified') : undefined,
      reviewed_by: dto.reviewer_id,
      reviewed_at: new Date().toISOString(),
    });
  }
}
