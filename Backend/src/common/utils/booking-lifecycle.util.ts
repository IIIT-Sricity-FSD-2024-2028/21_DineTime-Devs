import { Reservation, Restaurant, TimeSlot } from 'src/common/types/schema.types';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { PaymentRepository } from 'src/repositories/payment.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { reservationTableIds } from './reservation-tables.util';
import { slotInstant } from './india-time.util';

export const HOLD_MINUTES = 10;
export const NO_SHOW_POLICY = 'After the arrival grace period, no-show payments stay held for finance review. Finance may release the restaurant share, refund the deposit, or issue a full refund for a restaurant-caused failure.';
export function bookingTerms(restaurant: Restaurant) {
  return {cancellation_cutoff_minutes:restaurant.cancellation_cutoff_minutes ?? 0,no_show_grace_minutes:restaurant.no_show_grace_minutes ?? 0,no_show_policy:NO_SHOW_POLICY};
}
export function deadlineFor(slot: TimeSlot, minutes: number) {
  return new Date(slotInstant(slot.slot_date,slot.start_time)-minutes*60000).toISOString();
}
export function expireUnpaidHolds(reservations:ReservationRepository,payments:PaymentRepository,allocations:TableSlotRepository) {
  const now=Date.now();
  for(const reservation of reservations.findAll()) {
    if(reservation.reservation_status!=='reserved' || !reservation.hold_expires_at || reservation.confirmed_at || Date.parse(reservation.hold_expires_at)>now)continue;
    if(payments.findByReservationId(reservation.id).some(p=>p.payment_status==='paid'))continue;
    reservation.reservation_status='cancelled';reservation.expired_at=new Date(now).toISOString();
    reservationTableIds(reservation).forEach(id=>{
      // Release only this reservation's allocation, never a newer booking.
      if(!reservations.findByTableAndSlot(id,reservation.slot_id))allocations.updateStatus(id,reservation.slot_id,'available');
    });
    payments.findByReservationId(reservation.id).filter(p=>p.payment_status==='pending').forEach(p=>payments.update(p.id,{payment_status:'failed'}));
  }
}
export function hasUnpaidHold(reservation:Reservation) { return Boolean(reservation.hold_expires_at && !reservation.confirmed_at); }
