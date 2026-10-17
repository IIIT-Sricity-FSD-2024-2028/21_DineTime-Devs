import { store } from 'src/common/storage/memory-store';
import { Injectable } from '@nestjs/common';
import { Checkin } from 'src/common/types/schema.types';

@Injectable()
export class CheckinRepository {
  private readonly checkins: Checkin[] = store.collection<Checkin>('checkins');

  findAll(): Checkin[] {
    return [...this.checkins];
  }

  findByCheckinId(checkinId: string): Checkin | undefined {
    return this.checkins.find((item) => item.checkin_id === checkinId);
  }

  findByReservationId(reservationId: string): Checkin | undefined {
    return this.checkins.find((item) => item.reservation_id === reservationId);
  }

  create(checkin: Checkin): Checkin {
    this.checkins.push(checkin);
    return checkin;
  }

  remove(checkinId: string): boolean {
    const index = this.checkins.findIndex((item) => item.checkin_id === checkinId);
    if (index === -1) {
      return false;
    }

    this.checkins.splice(index, 1);
    return true;
  }
}
