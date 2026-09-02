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
  const deposit_amount = ratePerGuest * guestCount;

  return {
    rate_per_guest: ratePerGuest,
    guest_count: guestCount,
    deposit_amount,
    diner_platform_fee: DINER_PLATFORM_FEE,
    restaurant_platform_fee: RESTAURANT_PLATFORM_FEE,
    total_due: deposit_amount + DINER_PLATFORM_FEE,
    restaurant_payout: deposit_amount - RESTAURANT_PLATFORM_FEE,
  };
}
