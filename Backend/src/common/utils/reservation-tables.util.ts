import { Reservation } from 'src/common/types/schema.types';

export function reservationTableIds(reservation: Pick<Reservation, 'table_id' | 'table_ids'>): string[] {
  return reservation.table_ids?.length
    ? [...reservation.table_ids]
    : reservation.table_id ? [reservation.table_id] : [];
}
