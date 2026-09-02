import { Injectable } from '@nestjs/common';
import { Reservation } from 'src/common/types/schema.types';

@Injectable()
export class ReservationRepository {
  private readonly reservations: Reservation[] = [];

  findAll(): Reservation[] {
    return [...this.reservations];
  }

  findById(id: string): Reservation | undefined {
    return this.reservations.find((item) => item.id === id);
  }

  findByUserId(userId: string): Reservation[] {
    return this.reservations.filter((item) => item.user_id === userId);
  }

  findByRestaurantId(restaurantId: string): Reservation[] {
    return this.reservations.filter((item) => item.restaurant_id === restaurantId);
  }

  findByTableAndSlot(tableId: string, slotId: string): Reservation | undefined {
    return this.reservations.find(
      (item) => item.table_id === tableId && item.slot_id === slotId,
    );
  }

  findBySlotId(slotId: string): Reservation[] {
    return this.reservations.filter((item) => item.slot_id === slotId);
  }

  create(reservation: Reservation): Reservation {
    this.reservations.push(reservation);
    return reservation;
  }

  update(id: string, payload: Partial<Reservation>): Reservation | undefined {
    const reservation = this.findById(id);
    if (!reservation) {
      return undefined;
    }

    Object.assign(reservation, payload);
    return reservation;
  }

  remove(id: string): boolean {
    const index = this.reservations.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.reservations.splice(index, 1);
    return true;
  }
}
