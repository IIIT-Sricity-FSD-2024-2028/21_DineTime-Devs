import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_RESERVATION_FEE_PER_GUEST } from 'src/common/config/billing.config';
import { Role } from 'src/common/enums/role.enum';
import { calculateReservationBill } from 'src/common/utils/billing.util';
import { generateId } from 'src/common/utils/id.util';
import {
  CreateReservationDto,
  UpdateReservationDto,
} from 'src/modules/reservations/dto/reservations.dto';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlot } from 'src/common/types/schema.types';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  private billingFor(restaurantId: string, guestCount: number) {
    const restaurant = this.restaurantRepository.findById(restaurantId);
    return calculateReservationBill(
      guestCount,
      restaurant?.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST,
    );
  }

  private slotStartDate(slot: TimeSlot): Date {
    return new Date(`${slot.slot_date}T${slot.start_time}:00`);
  }

  private isNoShowEligible(reservation: { reservation_status: string; restaurant_id: string; slot_id?: string }): boolean {
    if (reservation.reservation_status !== 'reserved' || !reservation.slot_id) {
      return false;
    }

    const slot = this.timeSlotRepository.findById(reservation.slot_id);
    const restaurant = this.restaurantRepository.findById(reservation.restaurant_id);
    if (!slot || !restaurant) {
      return false;
    }

    const graceMs = (restaurant.no_show_grace_minutes ?? 0) * 60 * 1000;
    return Date.now() > this.slotStartDate(slot).getTime() + graceMs;
  }

  private decorate<T extends { reservation_status: string; restaurant_id: string; slot_id?: string }>(
    reservation: T,
  ) {
    return {
      ...reservation,
      status: reservation.reservation_status,
      no_show_eligible: this.isNoShowEligible(reservation),
    };
  }

  findAll(userId?: string, restaurantId?: string) {
    if (restaurantId) {
      return this.reservationRepository.findAll()
        .filter((reservation) => reservation.restaurant_id === restaurantId)
        .map((reservation) => this.decorate(reservation));
    }

    if (userId) {
      return this.reservationRepository.findByUserId(userId).map((reservation) => this.decorate(reservation));
    }

    return this.reservationRepository.findAll().map((reservation) => this.decorate(reservation));
  }

  findOne(id: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return this.decorate(reservation);
  }

  create(dto: CreateReservationDto) {
    const table = this.tableRepository.findById(dto.table_id);
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Table does not belong to the restaurant');
    }

    if (table.capacity < dto.guest_count) {
      throw new BadRequestException('Guest count exceeds table capacity');
    }

    const slot = this.timeSlotRepository.findById(dto.slot_id);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    if (slot.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Time slot does not belong to the restaurant');
    }

    const tableSlot = this.tableSlotRepository.findByTableAndSlot(
      dto.table_id,
      dto.slot_id,
    );
    if (!tableSlot) {
      throw new NotFoundException('Table slot not found');
    }

    const existingReservation = this.reservationRepository.findByTableAndSlot(
      dto.table_id,
      dto.slot_id,
    );

    // Idempotent behavior: if the same user submits the same reservation again,
    // return the existing reservation instead of failing the core flow.
    if (
      existingReservation &&
      existingReservation.reservation_status !== 'cancelled' &&
      existingReservation.user_id === dto.user_id
    ) {
      return {
        ...this.decorate(existingReservation),
        billing: this.billingFor(dto.restaurant_id, existingReservation.guest_count),
      };
    }

    if (tableSlot.status !== 'available') {
      throw new BadRequestException('Selected table slot is not available');
    }

    if (existingReservation && existingReservation.reservation_status !== 'cancelled') {
      throw new BadRequestException('Table already reserved for this slot');
    }

    const reservation = this.reservationRepository.create({
      id: generateId('reservation'),
      user_id: dto.user_id,
      restaurant_id: dto.restaurant_id,
      table_id: dto.table_id,
      slot_id: dto.slot_id,
      guest_count: dto.guest_count,
          reservation_status: 'reserved',
          created_at: new Date().toISOString(),
    });

    this.tableSlotRepository.updateStatus(dto.table_id, dto.slot_id, 'reserved');

    this.notificationsService.create(
      dto.user_id,
      'Reservation confirmed',
      'reservation_confirmation',
    );

    return {
      ...this.decorate(reservation),
      billing: this.billingFor(dto.restaurant_id, dto.guest_count),
    };
  }

  update(id: string, dto: UpdateReservationDto, actingRole?: Role) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (
      dto.reservation_status === 'completed' &&
      reservation.reservation_status !== 'checked_in'
    ) {
      throw new BadRequestException(
        'Reservation can be completed only after check-in',
      );
    }

    if (dto.reservation_status === 'cancelled') {
      if (actingRole === Role.MANAGER) {
        throw new ForbiddenException('Managers cannot cancel reservations');
      }

      if (actingRole === Role.DINER && reservation.slot_id) {
        const slot = this.timeSlotRepository.findById(reservation.slot_id);
        const restaurant = this.restaurantRepository.findById(reservation.restaurant_id);
        if (slot && restaurant) {
          const cutoffMs = (restaurant.cancellation_cutoff_minutes ?? 0) * 60 * 1000;
          if (Date.now() > this.slotStartDate(slot).getTime() - cutoffMs) {
            throw new BadRequestException(
              `Cancellations are only allowed up to ${restaurant.cancellation_cutoff_minutes} minutes before your reservation`,
            );
          }
        }
      }
    }

    if (dto.reservation_status === 'no_show' && actingRole !== Role.STAFF && actingRole !== Role.SUPER_USER) {
      throw new ForbiddenException('Only restaurant staff can mark a reservation as a no-show');
    }

    const wasCancellable = reservation.reservation_status !== 'cancelled';
    const updated = this.reservationRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Reservation not found');
    }

    if (dto.reservation_status && reservation.table_id && reservation.slot_id) {
      const nextTableSlotStatus =
        dto.reservation_status === 'checked_in'
          ? 'occupied'
          : dto.reservation_status === 'reserved'
            ? 'reserved'
            : 'available';

      this.tableSlotRepository.updateStatus(
        reservation.table_id,
        reservation.slot_id,
        nextTableSlotStatus,
      );
    }

    let refund: { refunded_amount: number; payment_id: string } | undefined;
    if (dto.reservation_status === 'cancelled' && wasCancellable) {
      const paidPayment = this.paymentRepository
        .findByReservationId(id)
        .find((payment) => payment.payment_status === 'paid');

      if (paidPayment) {
        this.paymentRepository.update(paidPayment.id, {
          payment_status: 'refunded',
          refunded_amount: paidPayment.deposit_amount,
        });
        refund = { refunded_amount: paidPayment.deposit_amount, payment_id: paidPayment.id };
        this.notificationsService.create(
          updated.user_id,
          `Reservation cancelled — ₹${paidPayment.deposit_amount} refunded`,
          'refund_processed',
        );
      }
    }

    return {
      ...this.decorate(updated),
      ...(refund ? { refund } : {}),
    };
  }

  delete(id: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    const deleted = this.reservationRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.table_id && reservation.slot_id) {
      this.tableSlotRepository.updateStatus(
        reservation.table_id,
        reservation.slot_id,
        'available',
      );
    }

    return { deleted: true };
  }
}
