import { SETTLEMENT_DEADLINE_DAYS } from 'src/common/config/billing.config';
import { Payment } from 'src/common/types/schema.types';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';

const SETTLEMENT_DEADLINE_MS = SETTLEMENT_DEADLINE_DAYS * 24 * 60 * 60 * 1000;

export function netPayout(payment: Payment): number {
  return payment.deposit_amount - payment.restaurant_platform_fee;
}

export function settlementDeadline(payment: Payment): number {
  return new Date(payment.payment_time).getTime() + SETTLEMENT_DEADLINE_MS;
}

/**
 * Anything paid, unsettled, and past its 7-day deadline gets auto-settled —
 * finance can settle manually any time before that; this is just the backstop.
 * A restaurant with payouts blocked is skipped entirely until unblocked.
 */
export function autoSettleOverduePayments(
  paymentRepository: PaymentRepository,
  reservationRepository: ReservationRepository,
  restaurantRepository: RestaurantRepository,
): void {
  const now = Date.now();
  paymentRepository.findAll().forEach((payment) => {
    if (
      payment.payment_status !== 'paid' ||
      payment.settled_at ||
      payment.payout_blocked ||
      now < settlementDeadline(payment)
    ) {
      return;
    }

    const reservation = reservationRepository.findById(payment.reservation_id);
    const restaurant = reservation ? restaurantRepository.findById(reservation.restaurant_id) : undefined;
    if (restaurant?.payout_blocked) {
      return;
    }

    paymentRepository.update(payment.id, {
      settled_at: new Date(now).toISOString(),
      settled_by: 'auto',
    });
  });
}
