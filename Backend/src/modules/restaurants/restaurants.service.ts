import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_CANCELLATION_CUTOFF_MINUTES,
  DEFAULT_NO_SHOW_GRACE_MINUTES,
  DEFAULT_RESERVATION_FEE_PER_GUEST,
} from 'src/common/config/billing.config';
import { Role } from 'src/common/enums/role.enum';
import { generateId } from 'src/common/utils/id.util';
import { autoSettleOverduePayments, netPayout } from 'src/common/utils/settlement.util';
import {
  CreateLocationDto,
  CreateRestaurantDto,
  UpdateRestaurantDto,
} from 'src/modules/restaurants/dto/restaurants.dto';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly userRepository: UserRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  findAll(city?: string, actingRole?: Role) {
    let restaurants = city
      ? this.restaurantRepository.findRestaurantsByCity(city)
      : this.restaurantRepository.findAll();

    if (actingRole === Role.DINER) {
      restaurants = restaurants.filter((restaurant) => {
        if (!restaurant.is_open) {
          return false;
        }
        const managerDetails = this.userRepository.getManagerDetails(restaurant.manager_id);
        return managerDetails?.verification_status === 'approved';
      });
    }

    return restaurants;
  }

  findAllLocations() {
    return this.restaurantRepository.findAllLocations();
  }

  findOne(id: string) {
    const restaurant = this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  create(dto: CreateRestaurantDto) {
    const duplicate = this.restaurantRepository.findAll().find((restaurant) =>
      restaurant.location_id === dto.location_id
      && String(restaurant.name || '').trim().toLowerCase() === String(dto.name || '').trim().toLowerCase(),
    );

    if (duplicate) {
      throw new BadRequestException('Restaurant with the same name already exists at this location');
    }

    return this.restaurantRepository.create({
      id: generateId('restaurant'),
      manager_id: dto.manager_id,
      location_id: dto.location_id,
      name: dto.name,
      cuisine_type: dto.cuisine_type,
      description: dto.description,
      total_tables: dto.total_tables ?? 0,
      rating_avg: dto.rating_avg ?? 0,
      total_reviews: dto.total_reviews ?? 0,
      status: dto.status ?? 'active',
      is_open: false,
      created_at: new Date().toISOString(),
      image_urls: dto.image_urls || [],
      reservation_fee_per_guest:
        dto.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST,
      cancellation_cutoff_minutes:
        dto.cancellation_cutoff_minutes ?? DEFAULT_CANCELLATION_CUTOFF_MINUTES,
      no_show_grace_minutes:
        dto.no_show_grace_minutes ?? DEFAULT_NO_SHOW_GRACE_MINUTES,
      opens_at: dto.opens_at ?? '11:00',
      closes_at: dto.closes_at ?? '23:00',
    });
  }

  setServingStatus(id: string, managerId: string, isOpen: boolean) {
    const restaurant = this.findOne(id);
    if (restaurant.manager_id !== managerId) {
      throw new BadRequestException('You do not manage this restaurant');
    }

    const managerDetails = this.userRepository.getManagerDetails(managerId);
    if (managerDetails?.verification_status !== 'approved') {
      throw new BadRequestException('Restaurant is not verified yet');
    }

    const updated = this.restaurantRepository.update(id, { is_open: isOpen });
    if (!updated) {
      throw new NotFoundException('Restaurant not found');
    }

    return updated;
  }

  revenue(id: string, managerId?: string) {
    const restaurant = this.findOne(id);
    if (managerId && restaurant.manager_id !== managerId) {
      throw new BadRequestException('You do not manage this restaurant');
    }

    autoSettleOverduePayments(this.paymentRepository, this.reservationRepository, this.restaurantRepository);

    const reservations = this.reservationRepository.findByRestaurantId(id);
    const paidPayments = reservations
      .flatMap((reservation) => this.paymentRepository.findByReservationId(reservation.id))
      .filter((payment) => payment.payment_status === 'paid');

    const settledPayments = paidPayments.filter((payment) => payment.settled_at);
    const pending_payout = paidPayments
      .filter((payment) => !payment.settled_at)
      .reduce((sum, payment) => sum + netPayout(payment), 0);
    const paid_by_platform = settledPayments.reduce((sum, payment) => sum + netPayout(payment), 0);

    // Payments settled together (same settle-all run or auto-settle sweep) share
    // an identical settled_at timestamp, so grouping by it reconstructs each payout batch.
    const batches = new Map<string, { amount: number; payment_count: number }>();
    settledPayments.forEach((payment) => {
      const key = payment.settled_at as string;
      const entry = batches.get(key) || { amount: 0, payment_count: 0 };
      entry.amount += netPayout(payment);
      entry.payment_count += 1;
      batches.set(key, entry);
    });

    const settlement_history = Array.from(batches.entries())
      .map(([settledAt, entry]) => ({ settled_at: settledAt, ...entry }))
      .sort((a, b) => b.settled_at.localeCompare(a.settled_at));

    return {
      pending_payout,
      paid_by_platform,
      settlement_history,
    };
  }

  createLocation(dto: CreateLocationDto) {
    return this.restaurantRepository.upsertLocation({
      id: dto.id || generateId('location'),
      latitude: dto.latitude ?? 0,
      longitude: dto.longitude ?? 0,
      city: dto.city,
      pincode: dto.pincode,
      address: dto.address,
      country: dto.country,
    });
  }

  findLocation(id: string) {
    const location = this.restaurantRepository.findLocationById(id);
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  update(id: string, dto: UpdateRestaurantDto) {
    const updated = this.restaurantRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Restaurant not found');
    }

    return updated;
  }

  uploadImage(id: string, imageUrl: string) {
    const restaurant = this.findOne(id);
    const imageUrls = [...(restaurant.image_urls || []), imageUrl];
    const updated = this.restaurantRepository.update(id, { image_urls: imageUrls });

    if (!updated) {
      throw new NotFoundException('Restaurant not found');
    }

    return updated;
  }

  delete(id: string) {
    const deleted = this.restaurantRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException('Restaurant not found');
    }

    return { deleted: true };
  }
}
