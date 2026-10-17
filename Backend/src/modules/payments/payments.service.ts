import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_RESERVATION_FEE_PER_GUEST } from 'src/common/config/billing.config';
import { calculateReservationBill } from 'src/common/utils/billing.util';
import { generateId } from 'src/common/utils/id.util';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { CreateAdditionalPaymentDto, CreatePaymentDto, UpdatePaymentDto } from 'src/modules/payments/dto/payments.dto';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { reservationTableIds } from 'src/common/utils/reservation-tables.util';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly restaurantRepository: RestaurantRepository,
    private readonly tableRepository: TableRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  findAll(reservationId?: string) {
    if (reservationId) {
      return this.paymentRepository.findByReservationId(reservationId).map((payment) => ({
        ...payment,
        status: payment.payment_status,
      }));
    }

    return this.paymentRepository.findAll().map((payment) => ({
      ...payment,
      status: payment.payment_status,
    }));
  }

  findOne(id: string) {
    const payment = this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return {
      ...payment,
      status: payment.payment_status,
    };
  }

  create(dto: CreatePaymentDto) {
    const reservation = this.reservationRepository.findById(dto.reservation_id);
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    const existingPayments = this.paymentRepository.findByReservationId(dto.reservation_id);
    const existingPaid = existingPayments.find(p => p.payment_status === 'paid');
    
    // Idempotent behavior: if a paid payment already exists for this reservation,
    // return it instead of creating a new one (prevents duplicate fast payments on refresh).
    if (existingPaid) {
      return {
        ...existingPaid,
        status: existingPaid.payment_status,
      };
    }

    const restaurant = this.restaurantRepository.findById(reservation.restaurant_id);
    const bill = calculateReservationBill(
      this.reservationTableCapacity(reservation),
      restaurant?.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST,
    );

    const payment = this.paymentRepository.create({
      id: generateId('payment'),
      reservation_id: dto.reservation_id,
      restaurant_id: reservation.restaurant_id,
      amount: bill.total_due,
      deposit_amount: bill.deposit_amount,
      table_seat_count: this.reservationTableCapacity(reservation),
      diner_platform_fee: bill.diner_platform_fee,
      restaurant_platform_fee: bill.restaurant_platform_fee,
      payment_method: dto.payment_method,
      transaction_ref: dto.transaction_ref,
      payment_status: dto.payment_status || 'paid',
      payment_time: new Date().toISOString(),
    });

    if (payment.payment_status === 'paid') {
      this.reservationRepository.update(reservation.id, {
        paid_seat_count: this.reservationTableCapacity(reservation),
      });
      this.notificationsService.create(
        reservation.user_id,
        'Payment successful',
        'payment_success',
      );
    }

    return {
      ...payment,
      status: payment.payment_status,
    };
  }

  createAdditional(dto: CreateAdditionalPaymentDto) {
    const reservation = this.reservationRepository.findById(dto.reservation_id);
    if (!reservation) throw new NotFoundException('Reservation not found');
    const pending = reservation.pending_modification;
    if (!pending) throw new BadRequestException('No rescheduled booking is waiting for payment');
    const restaurant = this.restaurantRepository.findById(reservation.restaurant_id);
    const rate = restaurant?.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST;
    const targetTable = this.tableRepository.findById(pending.table_id);
    if (!targetTable || targetTable.restaurant_id !== reservation.restaurant_id) {
      throw new BadRequestException('The selected table is no longer available');
    }
    const targetSlot = this.timeSlotRepository.findById(pending.slot_id);
    if (!targetSlot || targetSlot.restaurant_id !== reservation.restaurant_id ||
        new Date(`${targetSlot.slot_date}T${targetSlot.start_time}`).getTime() <= Date.now()) {
      throw new BadRequestException('The selected time is no longer available');
    }
    const initialTableId = reservation.modification_history?.[0]?.table_ids?.[0] ?? reservation.table_id;
    const initialCapacity = reservation.initial_table_capacity ?? this.tableRepository.findById(initialTableId || '')?.capacity ?? 0;
    const targetCapacity = this.reservationTableCapacity({ table_id: pending.table_id, slot_id: pending.slot_id });
    if (targetCapacity < Math.max(initialCapacity, pending.guest_count)) {
      throw new BadRequestException('The selected table no longer meets the reservation seat requirements');
    }
    if ((reservation.modification_history || []).length >= 2) {
      throw new BadRequestException('A reservation can only be rescheduled twice');
    }
    const slotAllocation = this.tableSlotRepository.findByTableAndSlot(pending.table_id, pending.slot_id);
    const oldTableIds = reservationTableIds(reservation);
    const isOwnAllocation = reservation.slot_id === pending.slot_id && oldTableIds.includes(pending.table_id);
    const conflict = this.reservationRepository.findByTableAndSlot(pending.table_id, pending.slot_id);
    if (!slotAllocation || (!isOwnAllocation && slotAllocation.status !== 'available') || (conflict && conflict.id !== reservation.id)) {
      throw new BadRequestException('The selected table is no longer available. Your original reservation remains unchanged.');
    }
    const priorPaidPayments = this.paymentRepository.findByReservationId(reservation.id)
      .filter((item) => item.payment_status === 'paid');
    const paidSeats = reservation.paid_seat_count ?? (priorPaidPayments.reduce((sum, item) => sum + (item.table_seat_count ?? 0), 0) ||
      (priorPaidPayments.length ? Math.floor(priorPaidPayments.reduce((sum, item) => sum + item.deposit_amount, 0) / rate) : 0));
    const targetSeats = targetCapacity;
    const due = Math.max(0, targetSeats - paidSeats) * rate;
    if (due <= 0) throw new BadRequestException('No additional table seat payment is due');

    const payment = this.paymentRepository.create({
      id: generateId('payment'), reservation_id: reservation.id,
      restaurant_id: reservation.restaurant_id, amount: due, deposit_amount: due,
      table_seat_count: targetSeats - paidSeats,
      diner_platform_fee: 0, restaurant_platform_fee: 0,
      payment_method: dto.payment_method, transaction_ref: dto.transaction_ref,
      payment_status: 'paid', payment_time: new Date().toISOString(),
    });
    const history = [...(reservation.modification_history || []), {
      changed_at: new Date().toISOString(), restaurant_id: reservation.restaurant_id,
      slot_id: reservation.slot_id, table_ids: oldTableIds, guest_count: reservation.guest_count,
    }];
    oldTableIds.forEach((tableId) => this.tableSlotRepository.updateStatus(tableId, reservation.slot_id, 'available'));
    this.reservationRepository.update(reservation.id, {
      slot_id: pending.slot_id, table_id: pending.table_id,
      table_ids: [pending.table_id], guest_count: pending.guest_count,
      paid_seat_count: Math.max(paidSeats, targetSeats),
      modification_history: history, pending_modification: undefined,
    });
    this.tableSlotRepository.updateStatus(pending.table_id, pending.slot_id, 'reserved');
    this.notificationsService.create(reservation.user_id, 'Additional table seat payment successful', 'payment_success');
    return { ...payment, status: payment.payment_status };
  }

  private reservationTableCapacity(reservation: { table_id?: string; slot_id?: string }): number {
    // The reservation deposit is based on the booked table's seats, not party size.
    const table = reservation.table_id ? this.tableRepository.findById(reservation.table_id) : undefined;
    const slot = reservation.slot_id ? this.timeSlotRepository.findById(reservation.slot_id) : undefined;
    return slot?.table_layout?.find((entry) => entry.table_id === reservation.table_id)?.capacity ?? table?.capacity ?? 0;
  }

  update(id: string, dto: UpdatePaymentDto) {
    const previous = this.paymentRepository.findById(id);
    if (!previous) {
      throw new NotFoundException('Payment not found');
    }

    const updated = this.paymentRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Payment not found');
    }

    if (previous.payment_status !== 'paid' && updated.payment_status === 'paid') {
      const reservation = this.reservationRepository.findById(updated.reservation_id);
      if (reservation) {
        this.notificationsService.create(
          reservation.user_id,
          'Payment successful',
          'payment_success',
        );
      }
    }

    return {
      ...updated,
      status: updated.payment_status,
    };
  }

  delete(id: string) {
    const deleted = this.paymentRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException('Payment not found');
    }

    return { deleted: true };
  }
}
