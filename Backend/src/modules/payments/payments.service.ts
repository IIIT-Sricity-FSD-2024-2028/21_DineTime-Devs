import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_RESERVATION_FEE_PER_GUEST } from 'src/common/config/billing.config';
import { calculateReservationBill } from 'src/common/utils/billing.util';
import { generateId } from 'src/common/utils/id.util';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { CreatePaymentDto, UpdatePaymentDto } from 'src/modules/payments/dto/payments.dto';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly restaurantRepository: RestaurantRepository,
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
      reservation.guest_count,
      restaurant?.reservation_fee_per_guest ?? DEFAULT_RESERVATION_FEE_PER_GUEST,
    );

    const payment = this.paymentRepository.create({
      id: generateId('payment'),
      reservation_id: dto.reservation_id,
      amount: bill.total_due,
      deposit_amount: bill.deposit_amount,
      diner_platform_fee: bill.diner_platform_fee,
      restaurant_platform_fee: bill.restaurant_platform_fee,
      payment_method: dto.payment_method,
      transaction_ref: dto.transaction_ref,
      payment_status: dto.payment_status,
      payment_time: new Date().toISOString(),
    });

    if (payment.payment_status === 'paid') {
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
