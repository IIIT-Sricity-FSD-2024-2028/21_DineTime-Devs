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
import { reservationTableIds } from 'src/common/utils/reservation-tables.util';
import {
  CreateReservationDto,
  ModifyReservationDto,
  UpdateReservationDto,
} from 'src/modules/reservations/dto/reservations.dto';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { Reservation, TimeSlot } from 'src/common/types/schema.types';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { releasePayment, releaseState } from 'src/common/utils/settlement.util';
import { SchedulesService } from 'src/modules/schedules/schedules.service';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly userRepository: UserRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly notificationsService: NotificationsService,
    private readonly schedules: SchedulesService,
  ) {}

  private billingFor(restaurantId: string, tableId: string, slot?: TimeSlot) {
    const restaurant = this.restaurantRepository.findById(restaurantId);
    const table = this.tableRepository.findById(tableId);
    return calculateReservationBill(
      this.capacityForSlot(slot, tableId, table?.capacity ?? 0),
      restaurant?.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST,
    );
  }

  private capacityForSlot(slot: TimeSlot | undefined, tableId: string, fallback: number) {
    return slot?.table_layout?.find((entry) => entry.table_id === tableId)?.capacity ?? fallback;
  }

  private slotStartDate(slot: TimeSlot): Date {
    const time = slot.start_time.includes(':')
      ? (slot.start_time.split(':').length === 2 ? `${slot.start_time}:00` : slot.start_time)
      : `${slot.start_time}:00`;
    return new Date(`${slot.slot_date}T${time}`);
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

  private decorate<T extends Reservation>(
    reservation: T,
  ) {
    const initialTableId = reservation.modification_history?.[0]?.table_ids?.[0] ?? reservation.table_id;
    const initialTableCapacity = reservation.initial_table_capacity ?? this.tableRepository.findById(initialTableId || '')?.capacity;
    const restaurant = this.restaurantRepository.findById(reservation.restaurant_id);
    const rate = restaurant?.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST;
    const payments = this.paymentRepository.findByReservationId(reservation.id);
    const payment = payments.find((item) => item.payment_status === 'paid') ||
      payments.find((item) => item.payment_status === 'refunded') || payments[payments.length - 1];
    const paidPayments = payments.filter((item) => item.payment_status === 'paid');
    const slot = this.timeSlotRepository.findById(reservation.slot_id);
    return {
      ...reservation,
      // Booking details must survive removal from the discovery catalogue.
      restaurant_summary: restaurant ? {
        id: restaurant.id, name: restaurant.name, cuisine_type: restaurant.cuisine_type,
        description: restaurant.description, image_urls: restaurant.image_urls,
        location_id: restaurant.location_id, is_open: restaurant.is_open,
        is_closed: Boolean(restaurant.is_closed), rating_avg: restaurant.rating_avg,
        total_reviews: restaurant.total_reviews,
        reservation_fee_per_guest: restaurant.reservation_fee_per_guest,
        cancellation_cutoff_minutes: restaurant.cancellation_cutoff_minutes,
        no_show_grace_minutes: restaurant.no_show_grace_minutes,
      } : null,
      slot_date: slot?.slot_date,
      start_time: slot?.start_time,
      end_time: slot?.end_time,
      initial_guest_count: reservation.initial_guest_count ?? reservation.modification_history?.[0]?.guest_count ?? reservation.guest_count,
      initial_table_capacity: initialTableCapacity,
      paid_seat_count: reservation.paid_seat_count ?? (paidPayments.reduce((sum, item) => sum + (item.table_seat_count ?? 0), 0) ||
        (paidPayments.length ? Math.floor(paidPayments.reduce((sum, item) => sum + item.deposit_amount, 0) / rate) : 0)),
      status: reservation.reservation_status,
      no_show_eligible: this.isNoShowEligible(reservation),
      table_ids: reservationTableIds(reservation),
      payment_summary: payment ? {
        id: payment.id,
        amount: paidPayments.length ? paidPayments.reduce((sum, item) => sum + item.amount, 0) : payment.amount,
        deposit_amount: paidPayments.length ? paidPayments.reduce((sum, item) => sum + item.deposit_amount, 0) : payment.deposit_amount,
        diner_platform_fee: paidPayments.length ? paidPayments.reduce((sum, item) => sum + item.diner_platform_fee, 0) : payment.diner_platform_fee,
        payment_status: paidPayments.length ? 'paid' : payment.payment_status,
        payment_method: payment.payment_method, payment_time: payment.payment_time,
        transaction_ref: payment.transaction_ref, refunded_amount: payment.refunded_amount ?? 0,
      } : null,
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
    const restaurant = this.restaurantRepository.findById(dto.restaurant_id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const managerDetails = this.userRepository.getManagerDetails(restaurant.manager_id);
    if (!restaurant.is_open || restaurant.is_closed || managerDetails?.verification_status !== 'approved') {
      throw new BadRequestException('Restaurant is not available for reservations');
    }

    const table = this.tableRepository.findById(dto.table_id);
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    if (table.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Table does not belong to the restaurant');
    }

    const slot = this.timeSlotRepository.findById(dto.slot_id);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    const configuredCapacity = this.capacityForSlot(slot, table.id, table.capacity);
    if (configuredCapacity < dto.guest_count) {
      throw new BadRequestException('Guest count exceeds table capacity');
    }

    if (slot.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Time slot does not belong to the restaurant');
    }

    if (!this.schedules.isSlotAllowed(dto.restaurant_id, slot.slot_date, slot.start_time, slot.end_time) ||
      this.schedules.isTableBlocked(dto.restaurant_id, slot.slot_date, slot.start_time, slot.end_time, dto.table_id)) {
      throw new BadRequestException('This time or table is not available under the restaurant schedule.');
    }

    const slotStartDate = this.slotStartDate(slot);
    if (isNaN(slotStartDate.getTime()) || slotStartDate.getTime() < Date.now()) {
      throw new BadRequestException('Cannot book a table for a past date or time');
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
        billing: this.billingFor(dto.restaurant_id, existingReservation.table_id || reservationTableIds(existingReservation)[0] || '', slot),
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
      initial_guest_count: dto.guest_count,
      initial_table_capacity: configuredCapacity,
      paid_seat_count: 0,
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
      billing: this.billingFor(dto.restaurant_id, dto.table_id, slot),
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
    if (dto.reservation_status === 'completed' && actingRole === Role.DINER) {
      throw new ForbiddenException('Use the Dine Complete action after check-in');
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
    const updated = this.reservationRepository.update(id, {
      ...dto,
      ...(dto.reservation_status === 'completed'
        ? { completed_at: reservation.completed_at || new Date().toISOString() }
        : {}),
    });
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

      reservationTableIds(reservation).forEach((tableId) => {
        const otherReservation = this.reservationRepository.findBySlotId(reservation.slot_id!)
          .find((candidate) =>
            candidate.id !== reservation.id &&
            ['reserved', 'checked_in'].includes(candidate.reservation_status) &&
            reservationTableIds(candidate).includes(tableId),
          );
        const statusWithConflict = otherReservation
          ? otherReservation.reservation_status === 'checked_in' ? 'occupied' : 'reserved'
          : nextTableSlotStatus;
        this.tableSlotRepository.updateStatus(tableId, reservation.slot_id!, statusWithConflict);
      });
    }

    let refund: { refunded_amount: number; payment_id: string } | undefined;
    if (dto.reservation_status === 'cancelled' && wasCancellable) {
      const paidPayments = this.paymentRepository
        .findByReservationId(id)
        .filter((payment) => payment.payment_status === 'paid');

      if (paidPayments.length) {
        const refundedAmount = paidPayments.reduce((sum, payment) => sum + payment.deposit_amount, 0);
        paidPayments.forEach((paidPayment) => this.paymentRepository.update(paidPayment.id, {
          payment_status: 'refunded', refunded_amount: paidPayment.deposit_amount,
        }));
        refund = { refunded_amount: refundedAmount, payment_id: paidPayments[0].id };
        this.notificationsService.create(
          updated.user_id,
          `Reservation cancelled — ₹${refundedAmount} refunded`,
          'refund_processed',
        );
      }
    }

    return {
      ...this.decorate(updated),
      ...(refund ? { refund } : {}),
    };
  }

  completeByDiner(id: string, userId?: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (!userId || reservation.user_id !== userId) {
      throw new ForbiddenException('You can only complete your own reservation');
    }
    if (reservation.diner_completed_at) {
      const payments = this.paymentRepository.findByReservationId(id).filter((payment) => payment.payment_status === 'paid');
      return { ...this.decorate(reservation), payout_release: payments.length && payments.every((payment) => releaseState(payment, reservation) === 'released') ? 'released' : payments.length ? releaseState(payments[0], reservation) : 'not_paid' };
    }
    if (!['checked_in', 'completed'].includes(reservation.reservation_status)) {
      throw new BadRequestException('Dine Complete is available only after staff check-in');
    }

    const completedAt = reservation.completed_at || new Date().toISOString();
    const updated = this.reservationRepository.update(id, {
      reservation_status: 'completed',
      completed_at: completedAt,
      diner_completed_at: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundException('Reservation not found');
    if (reservation.slot_id) {
      reservationTableIds(reservation).forEach((tableId) => {
        const otherReservation = this.reservationRepository.findBySlotId(reservation.slot_id!)
          .find((candidate) =>
            candidate.id !== reservation.id &&
            ['reserved', 'checked_in'].includes(candidate.reservation_status) &&
            reservationTableIds(candidate).includes(tableId),
          );
        const status = otherReservation
          ? otherReservation.reservation_status === 'checked_in' ? 'occupied' : 'reserved'
          : 'available';
        this.tableSlotRepository.updateStatus(tableId, reservation.slot_id!, status);
      });
    }

    const paidPayments = this.paymentRepository.findByReservationId(id)
      .filter((payment) => payment.payment_status === 'paid');
    paidPayments.forEach((payment) => releasePayment(
      this.paymentRepository, payment, updated, this.restaurantRepository, userId, 'diner'));
    const payoutRelease = paidPayments.length
      ? paidPayments.every((payment) => releaseState(payment, updated) === 'released')
        ? 'released'
        : releaseState(paidPayments[0], updated)
      : 'not_paid';
    return { ...this.decorate(updated), payout_release: payoutRelease };
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
      reservationTableIds(reservation).forEach((tableId) =>
        this.tableSlotRepository.updateStatus(tableId, reservation.slot_id, 'available'));
    }

    return { deleted: true };
  }

  modify(id: string, dto: ModifyReservationDto, userId?: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (!userId || userId !== reservation.user_id) {
      throw new ForbiddenException('You can only modify your own reservation');
    }
    const oldSlot = this.timeSlotRepository.findById(reservation.slot_id);
    if (reservation.reservation_status !== 'reserved' || !oldSlot ||
        this.slotStartDate(oldSlot).getTime() <= Date.now()) {
      throw new BadRequestException('Only upcoming reservations can be modified before check-in');
    }
    const restaurant = this.restaurantRepository.findById(dto.restaurant_id);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const manager = this.userRepository.getManagerDetails(restaurant.manager_id);
    // Pausing new bookings must not prevent an existing diner rescheduling.
    if (restaurant.is_closed || manager?.verification_status !== 'approved') {
      throw new BadRequestException('Restaurant is not available for reservations');
    }
    const slot = this.timeSlotRepository.findById(dto.slot_id);
    if (!slot || slot.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Select a time slot belonging to this restaurant');
    }
    if (!Number.isFinite(this.slotStartDate(slot).getTime()) || this.slotStartDate(slot).getTime() <= Date.now()) {
      throw new BadRequestException('Select an upcoming date and time');
    }
    const oldTables = reservationTableIds(reservation);
    if (dto.restaurant_id !== reservation.restaurant_id) throw new BadRequestException('Reservations must stay at the original restaurant when rescheduling');
    if (dto.table_ids.length !== 1) throw new BadRequestException('Select exactly one table for a reservation');
    const tableId = dto.table_ids[0];
    const table = this.tableRepository.findById(tableId);
    if (!table || table.restaurant_id !== dto.restaurant_id) {
      throw new BadRequestException('Selected table does not belong to this restaurant');
    }
    const initialTableId = reservation.modification_history?.[0]?.table_ids?.[0] ?? reservation.table_id;
    const initialCapacity = reservation.initial_table_capacity ?? this.tableRepository.findById(initialTableId || '')?.capacity ?? 0;
    const minimumCapacity = Math.max(dto.guest_count, initialCapacity);
    const configuredCapacity = this.capacityForSlot(slot, table.id, table.capacity);
    if (configuredCapacity < minimumCapacity) {
      throw new BadRequestException(`Choose a table with at least ${minimumCapacity} seats`);
    }
    const allocation = this.tableSlotRepository.findByTableAndSlot(tableId, dto.slot_id);
    const isOwn = reservation.slot_id === dto.slot_id && oldTables.includes(tableId);
    if (isOwn) {
      throw new BadRequestException('Choose a different table or time to reschedule this reservation');
    }
    const conflict = this.reservationRepository.findByTableAndSlot(tableId, dto.slot_id);
    if (!this.schedules.isSlotAllowed(dto.restaurant_id, slot.slot_date, slot.start_time, slot.end_time) ||
      this.schedules.isTableBlocked(dto.restaurant_id, slot.slot_date, slot.start_time, slot.end_time, tableId) ||
      !allocation || allocation.status !== 'available' || (conflict && conflict.id !== id)) {
      throw new BadRequestException('A selected table is no longer available. Your original reservation is unchanged.');
    }
    const unchanged = reservation.restaurant_id === dto.restaurant_id &&
      reservation.slot_id === dto.slot_id && reservation.guest_count === dto.guest_count &&
      oldTables.length === dto.table_ids.length && oldTables.every((tableId) => dto.table_ids.includes(tableId));
    if (unchanged) {
      if (reservation.pending_modification) this.reservationRepository.update(id, { pending_modification: undefined });
      return this.decorate(reservation);
    }
    if ((reservation.modification_history || []).length >= 2) {
      throw new BadRequestException('A reservation can only be rescheduled twice');
    }

    const seatRate = restaurant.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST;
    const paidPayments = this.paymentRepository.findByReservationId(id).filter((payment) => payment.payment_status === 'paid');
    const recordedPaidSeats = paidPayments.reduce((sum, payment) => sum + (payment.table_seat_count ?? 0), 0);
    const paidSeats = reservation.paid_seat_count ?? (recordedPaidSeats ||
      (paidPayments.length ? Math.floor(paidPayments.reduce((sum, payment) => sum + payment.deposit_amount, 0) / seatRate) : 0));
    const additionalPaymentDue = Math.max(0, configuredCapacity - paidSeats) * seatRate;
    if (additionalPaymentDue > 0) {
      const pendingModification = {
        slot_id: dto.slot_id, table_id: tableId, guest_count: dto.guest_count,
        additional_payment_due: additionalPaymentDue,
      };
      this.reservationRepository.update(id, { pending_modification: pendingModification });
      return { ...this.decorate(reservation), pending_modification: pendingModification, additional_payment_due: additionalPaymentDue };
    }

    // All validation precedes this synchronous commit. Preserve payment amounts and
    // their original restaurant attribution, including payments already settled.
    const history = [...(reservation.modification_history || []), {
      changed_at: new Date().toISOString(), restaurant_id: reservation.restaurant_id,
      slot_id: reservation.slot_id, table_ids: oldTables, guest_count: reservation.guest_count,
    }];
    this.paymentRepository.findByReservationId(id).forEach((payment) => {
      if (!payment.restaurant_id) this.paymentRepository.update(payment.id, { restaurant_id: reservation.restaurant_id });
    });
    oldTables.forEach((tableId) => this.tableSlotRepository.updateStatus(tableId, reservation.slot_id, 'available'));
    this.reservationRepository.update(id, {
      restaurant_id: dto.restaurant_id, slot_id: dto.slot_id, table_id: dto.table_ids[0],
      table_ids: [tableId], guest_count: dto.guest_count, modification_history: history,
      initial_table_capacity: initialCapacity, pending_modification: undefined,
    });
    dto.table_ids.forEach((tableId) => this.tableSlotRepository.updateStatus(tableId, dto.slot_id, 'reserved'));
    this.notificationsService.create(reservation.user_id, additionalPaymentDue > 0
      ? `Reservation updated. An additional table seat payment of ₹${additionalPaymentDue} is due.`
      : 'Reservation updated successfully. No additional payment required.', 'reservation_update');
    return { ...this.decorate(reservation), additional_payment_due: additionalPaymentDue };
  }

  discardPendingModification(id: string, userId?: string) {
    const reservation = this.reservationRepository.findById(id);
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (!userId || userId !== reservation.user_id) {
      throw new ForbiddenException('You can only modify your own reservation');
    }
    this.reservationRepository.update(id, { pending_modification: undefined });
    return this.decorate(reservation);
  }
}
