import { BadRequestException } from '@nestjs/common';
export function cityName(value?: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (['bengaluru','bangalore','banglore'].includes(normalized)) return 'Bangalore';
  if (normalized === 'delhi') return 'Delhi';
  if (normalized === 'chennai') return 'Chennai';
  if (['hyderabad','hydrabad'].includes(normalized)) return 'Hyderabad';
  return String(value || '').trim();
}
export const servesCity = (value?: string) => ['bengaluru','bangalore','banglore'].includes(String(value || '').trim().toLowerCase());
export function validateLocation<T extends {city?:string;country?:string}>(value: T): T {
  if (value.country && value.country !== 'India') throw new BadRequestException('Only India is supported.');
  if (value.city !== undefined && !String(value.city).trim()) throw new BadRequestException('Choose a city.');
  return { ...value, ...(value.city !== undefined ? { city: String(value.city).trim(), country: 'India' } : {}) };
}
