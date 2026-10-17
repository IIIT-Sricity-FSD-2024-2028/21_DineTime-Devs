import { BadRequestException } from '@nestjs/common';
export const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export function slotInstant(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw new BadRequestException('Enter a valid date and time.');
  const result = Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}+05:30`);
  if (!Number.isFinite(result) || new Date(result + 330*60000).toISOString().slice(0,10) !== date) throw new BadRequestException('Enter a valid calendar date.');
  return result;
}
export function slotRange(date: string, start: string, end: string) {
  const from = slotInstant(date,start); let to = slotInstant(date,end);
  if (to <= from) to += 86400000;
  return { from, to };
}
