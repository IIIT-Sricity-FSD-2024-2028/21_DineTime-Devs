import { BadRequestException } from '@nestjs/common';

const day = 86400;
function seconds(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new BadRequestException('Operating hours must use valid opening and closing times (HH:MM).');
  }
  const [h, m, s = 0] = value.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}
export function validateOperatingHours(open: string, close: string) {
  const duration = (seconds(close) - seconds(open) + day) % day || day;
  if (duration < 7200) throw new BadRequestException('Operating hours must allow at least one two-hour session.');
}
export function withinOperatingHours(start: string, end: string, restaurant: { opens_at?: string; closes_at?: string }) {
  const open = seconds(restaurant.opens_at || '11:00');
  const close = seconds(restaurant.closes_at || '23:00');
  const from = seconds(start), to = seconds(end);
  const duration = (to - from + day) % day || day;
  // Equal opening and closing times mean open 24 hours.
  if (open === close) return true;
  return (from - open + day) % day + duration <= (close - open + day) % day;
}
