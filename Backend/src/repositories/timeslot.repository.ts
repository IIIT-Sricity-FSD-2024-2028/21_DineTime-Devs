import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { TimeSlot } from 'src/common/types/schema.types';

@Injectable()
export class TimeSlotRepository {
  private readonly slots: TimeSlot[] = store.collection<TimeSlot>('slots');

  findAll(): TimeSlot[] {
    return [...this.slots];
  }

  findById(id: string): TimeSlot | undefined {
    return this.slots.find((item) => item.id === id);
  }

  findByRestaurantId(restaurantId: string): TimeSlot[] {
    return this.slots.filter((item) => item.restaurant_id === restaurantId);
  }

  create(slot: TimeSlot): TimeSlot {
    this.slots.push(slot);
    return slot;
  }

  update(id: string, payload: Partial<TimeSlot>): TimeSlot | undefined {
    const slot = this.findById(id);
    if (!slot) {
      return undefined;
    }

    Object.assign(slot, payload);
    return slot;
  }

  remove(id: string): boolean {
    const index = this.slots.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.slots.splice(index, 1);
    return true;
  }
}
