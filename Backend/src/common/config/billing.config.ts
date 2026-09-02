export const DINER_PLATFORM_FEE = 20;
export const RESTAURANT_PLATFORM_FEE = 30;
export const DEFAULT_RESERVATION_FEE_PER_GUEST = 30;
export const DEFAULT_CANCELLATION_CUTOFF_MINUTES = 120;
export const DEFAULT_NO_SHOW_GRACE_MINUTES = 15;
// Finance can manually settle a paid reservation any time from day 0.
// If they haven't by this many days, it auto-settles as a fallback.
export const SETTLEMENT_DEADLINE_DAYS = 7;
