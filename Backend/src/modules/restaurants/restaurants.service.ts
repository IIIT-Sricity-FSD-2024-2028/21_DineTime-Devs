import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_CANCELLATION_CUTOFF_MINUTES,
  DEFAULT_NO_SHOW_GRACE_MINUTES,
  DEFAULT_RESERVATION_FEE_PER_GUEST,
} from 'src/common/config/billing.config';
import { Role } from 'src/common/enums/role.enum';
import { generateId } from 'src/common/utils/id.util';
import { autoSettleOverduePayments, payoutEntries } from 'src/common/utils/settlement.util';
import {
  CreateLocationDto,
  CreateRestaurantDto,
  UpdateRestaurantDto,
} from 'src/modules/restaurants/dto/restaurants.dto';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly userRepository: UserRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeslotRepository: TimeSlotRepository,
  ) {}

  findAll(city?: string, actingRole?: Role) {
    let restaurants = city
      ? this.restaurantRepository.findRestaurantsByCity(city)
      : this.restaurantRepository.findAll();

    if (actingRole === Role.DINER) {
      restaurants = restaurants.filter((restaurant) => {
        if (!restaurant.is_open || restaurant.is_closed) {
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

  findRestaurantCities() {
    return this.restaurantRepository.findRestaurantCities();
  }

  findOne(id: string, actingRole?: Role) {
    const restaurant = this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    if (actingRole === Role.DINER) {
      const managerDetails = this.userRepository.getManagerDetails(restaurant.manager_id);
      if (!restaurant.is_open || restaurant.is_closed || managerDetails?.verification_status !== 'approved') {
        throw new NotFoundException('Restaurant not found');
      }
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

    if (isOpen) {
      if (restaurant.is_closed) {
        throw new BadRequestException('Reopen the restaurant before accepting new reservations');
      }
      const managerDetails = this.userRepository.getManagerDetails(managerId);
      if (managerDetails?.verification_status !== 'approved') {
        throw new BadRequestException('Restaurant is not verified yet');
      }
      if (this.tableRepository.findByRestaurantId(id).length === 0) {
        throw new BadRequestException('Add at least one table before opening your restaurant');
      }
      if (this.timeslotRepository.findByRestaurantId(id).length === 0) {
        throw new BadRequestException('Add at least one time slot before opening your restaurant');
      }
    }

    const updated = this.restaurantRepository.update(id, { is_open: isOpen });
    if (!updated) {
      throw new NotFoundException('Restaurant not found');
    }

    return { ...updated, active_reservation_count: this.activeReservations(id).length };
  }

  private activeReservations(id: string) {
    return this.reservationRepository.findByRestaurantId(id)
      .filter((reservation) => ['reserved', 'checked_in'].includes(reservation.reservation_status));
  }

  setClosureStatus(id: string, managerId: string, isClosed: boolean) {
    const restaurant = this.findOne(id);
    if (restaurant.manager_id !== managerId) throw new BadRequestException('You do not manage this restaurant');
    const active = this.activeReservations(id);
    if (isClosed && active.length) {
      throw new ConflictException({
        message: `Cannot close the restaurant while ${active.length} active reservation(s) remain. Pause new reservations and resolve these bookings first.`,
        reservation_ids: active.map((reservation) => reservation.id),
      });
    }
    return this.restaurantRepository.update(id, {
      is_closed: isClosed,
      // Reopening does not silently resume taking new bookings.
      is_open: false,
    });
  }

  revenue(id: string, managerId?: string) {
    const restaurant = this.findOne(id);
    if (managerId && restaurant.manager_id !== managerId) {
      throw new BadRequestException('You do not manage this restaurant');
    }

    autoSettleOverduePayments(this.paymentRepository, this.reservationRepository, this.restaurantRepository);

    const entries = this.paymentRepository.findAll()
      .filter((payment) => ['paid', 'refunded'].includes(payment.payment_status))
      .flatMap((payment) => payoutEntries(payment, this.reservationRepository.findById(payment.reservation_id)?.restaurant_id)
        .filter((entry) => entry.restaurant_id === id && (payment.payment_status === 'paid' || entry.settled_at))
        .map((entry) => ({ ...entry, payment })));
    const settledPayments = entries.filter((entry) => entry.settled_at);
    const total = (rows: typeof entries) => Math.round(rows.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100;
    const pending_payout = total(entries.filter((entry) => !entry.settled_at));
    const paid_by_platform = total(settledPayments);

    // Payments settled together (same settle-all run or auto-settle sweep) share
    // an identical settled_at timestamp, so grouping by it reconstructs each payout batch.
    const batches = new Map<string, { amount: number; payment_count: number }>();
    settledPayments.forEach((payment) => {
      const key = payment.settled_at as string;
      const entry = batches.get(key) || { amount: 0, payment_count: 0 };
      entry.amount = Math.round((entry.amount + payment.amount) * 100) / 100;
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
      payments: settledPayments
        .sort((a, b) => b.settled_at!.localeCompare(a.settled_at!))
        .map((entry) => ({
          id: entry.id,
          payment_id: entry.payment.id,
          reservation_id: entry.payment.reservation_id,
          amount: entry.amount,
          status: 'paid_out',
          payment_time: entry.payment.payment_time,
          settled_at: entry.settled_at,
          settled_by: entry.settled_by,
        })),
    };
  }

  createLocation(dto: CreateLocationDto) {
    return this.restaurantRepository.upsertLocation({
      id: dto.id || generateId('location'),
      latitude: dto.latitude ?? 0,
      longitude: dto.longitude ?? 0,
      city: dto.city,
      state: dto.state,
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
    const { location_id: _locationId, ...editableDetails } = dto as UpdateRestaurantDto & { location_id?: string };
    const updated = this.restaurantRepository.update(id, editableDetails);
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
