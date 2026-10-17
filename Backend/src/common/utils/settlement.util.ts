import { Payment, Reservation } from 'src/common/types/schema.types';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';


export function netPayout(payment: Payment): number {
  return Math.max(0,Math.round((payment.deposit_amount - payment.restaurant_platform_fee)*100)/100);
}

export function payoutEntries(payment: Payment, fallbackRestaurantId?: string) {
  return [{ id: payment.id, restaurant_id: payment.payout_restaurant_id || payment.restaurant_id || fallbackRestaurantId,
    amount: netPayout(payment), created_at: payment.payment_time, settled_at: payment.settled_at,
    settled_by: payment.settled_by }, ...(payment.payout_adjustments || [])];
}

export function settlePayoutEntry(repository: PaymentRepository, payment: Payment, entryId: string, now: string, by: 'finance' | 'auto' | 'diner') {
  if (entryId === payment.id) repository.update(payment.id, { settled_at: now, settled_by: by });
  else repository.update(payment.id, { payout_adjustments: payment.payout_adjustments?.map((entry) =>
    entry.id === entryId ? { ...entry, settled_at: now, settled_by: by } : entry) });
}




export function releaseEligible(reservation?:Reservation) {
  return Boolean(reservation && (reservation.reservation_status==='completed' ||
    (reservation.reservation_status==='no_show' && reservation.no_show_review?.decision==='release')));
}
export function releaseState(payment:Payment,reservation?:Reservation) {
  if(payment.payment_status==='refunded')return 'refunded';
  if(payment.release_status==='released' || (payment.settled_at && !(payment.payout_adjustments || []).some(e=>!e.settled_at)))return 'released';
  if(reservation?.reservation_status==='no_show' && !reservation.no_show_review)return 'review';
  if(!releaseEligible(reservation))return 'held';
  return payment.release_status==='failed' || payment.release_status==='blocked' ? payment.release_status:'pending';
}
export function releasePayment(payments:PaymentRepository,payment:Payment,reservation:Reservation|undefined,restaurants:RestaurantRepository,actorId:string,by:'finance'|'auto'|'diner'='finance') {
  if(payment.payment_status!=='paid' || !releaseEligible(reservation))return false;
  const entries=payoutEntries(payment,reservation?.restaurant_id).filter(entry=>!entry.settled_at);
  if(!entries.length){payment.release_status='released';return true;}
  const blocked=payment.payout_blocked || entries.some(entry=>!entry.restaurant_id || restaurants.findById(entry.restaurant_id)?.payout_blocked);
  const status=blocked ? 'blocked':process.env.DINETIME_DEMO_PAYOUT_FAILURE==='1' ? 'failed':'released';
  const at=new Date().toISOString();
  payment.release_attempts=[...(payment.release_attempts || []),{at,actor_id:actorId,status,reason:blocked ? 'Payment or restaurant payouts are blocked.':status==='failed' ? 'Simulated transfer failure. Retry after service recovery.':undefined}];
  payment.release_status=status;
  if(status==='released')entries.forEach(entry=>settlePayoutEntry(payments,payment,entry.id,at,by));
  return status==='released';
}

const AUTO_SETTLEMENT_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

export function autoSettleOverduePayments(
  payments: PaymentRepository,
  reservations: ReservationRepository,
  restaurants: RestaurantRepository,
  now = Date.now(),
) {
  for (const payment of payments.findAll()) {
    if (payment.payment_status !== 'paid') continue;
    const reservation = reservations.findById(payment.reservation_id);
    if (reservation?.reservation_status !== 'completed') continue;
    const completedAt = reservation.completed_at || payment.payment_time;
    if (!completedAt || now - Date.parse(completedAt) < AUTO_SETTLEMENT_DELAY_MS) continue;
    releasePayment(payments, payment, reservation, restaurants, 'auto-settlement', 'auto');
  }
}
