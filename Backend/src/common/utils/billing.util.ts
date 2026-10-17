import {
  DINER_PLATFORM_FEE,
  RESTAURANT_PLATFORM_FEE,
} from 'src/common/config/billing.config';

export interface ReservationBill {
  rate_per_guest: number;
  guest_count: number;
  deposit_amount: number;
  diner_platform_fee: number;
  restaurant_platform_fee: number;
  total_due: number;
  restaurant_payout: number;
}

export function calculateReservationBill(
  guestCount: number,
  ratePerGuest: number,
): ReservationBill {
  const deposit_amount = Math.round(ratePerGuest * guestCount * 100) / 100;
  const restaurant_platform_fee = Math.min(RESTAURANT_PLATFORM_FEE, deposit_amount);

  return {
    rate_per_guest: ratePerGuest,
    guest_count: guestCount,
    deposit_amount,
    diner_platform_fee: DINER_PLATFORM_FEE,
    restaurant_platform_fee,
    total_due: Math.round((deposit_amount + DINER_PLATFORM_FEE) * 100) / 100,
    restaurant_payout: Math.round((deposit_amount - restaurant_platform_fee) * 100) / 100,
  };
}
