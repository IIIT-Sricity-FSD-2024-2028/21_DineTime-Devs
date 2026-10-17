import { Injectable } from '@nestjs/common';
import { RestaurantSchedule } from 'src/common/types/schema.types';
import { store } from 'src/common/storage/memory-store';

@Injectable()
export class ScheduleRepository {
  private readonly schedules = store.collection<RestaurantSchedule>('schedules');

  findByRestaurantId(restaurantId: string) {
    return this.schedules.find((schedule) => schedule.restaurant_id === restaurantId);
  }

  create(schedule: RestaurantSchedule) {
    this.schedules.push(schedule);
    return schedule;
  }

  update(restaurantId: string, payload: Partial<RestaurantSchedule>) {
    const schedule = this.findByRestaurantId(restaurantId);
    if (!schedule) return undefined;
    Object.assign(schedule, payload);
    return schedule;
  }
}
