import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
} from 'src/modules/timeslots/dto/timeslots.dto';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';

@Injectable()
export class TimeslotsService {
  constructor(
    private readonly timeslotRepository: TimeSlotRepository,
    private readonly tableRepository: TableRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly reservationRepository: ReservationRepository,
  ) {}

  private toMinutes(time: string): number {
    const [hRaw, mRaw] = String(time || '00:00').split(':');
    return Number(hRaw) * 60 + Number(mRaw);
  }

  private normalizedRange(startTime: string, endTime: string): { start: number; end: number } {
    const start = this.toMinutes(startTime);
    let end = this.toMinutes(endTime);
    if (end <= start) {
      end += 1440;
    }
    return { start, end };
  }

  private validateTwoHourSlot(startTime: string, endTime: string): void {
    const range = this.normalizedRange(startTime, endTime);
    if ((range.end - range.start) !== 120) {
      throw new BadRequestException('Time slot must be exactly 2 hours');
    }
  }

  private validateNoOverlap(
    restaurantId: string,
    slotDate: string,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): void {
    const candidate = this.normalizedRange(startTime, endTime);
    const sameDaySlots = this.timeslotRepository
      .findByRestaurantId(restaurantId)
      .filter((slot) => slot.slot_date === slotDate && slot.id !== excludeId);

    const hasOverlap = sameDaySlots.some((slot) => {
      const existing = this.normalizedRange(slot.start_time, slot.end_time);
      return candidate.start < existing.end && existing.start < candidate.end;
    });

    if (hasOverlap) {
      throw new BadRequestException('Time slot overlaps with an existing slot on this date');
    }
  }

  findAll(restaurantId?: string, slotDate?: string) {
    const byRestaurant = restaurantId
      ? this.timeslotRepository.findByRestaurantId(restaurantId)
      : this.timeslotRepository.findAll();

    const filtered = slotDate
      ? byRestaurant.filter((slot) => slot.slot_date === slotDate)
      : byRestaurant;

    return filtered.map((slot) => ({
        ...slot,
        date: slot.slot_date,
      }));
  }

  findOne(id: string) {
    const slot = this.timeslotRepository.findById(id);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    return {
      ...slot,
      date: slot.slot_date,
    };
  }

  create(dto: CreateTimeSlotDto) {
    this.validateTwoHourSlot(dto.start_time, dto.end_time);
    this.validateNoOverlap(
      dto.restaurant_id,
      dto.slot_date,
      dto.start_time,
      dto.end_time,
    );

    const slot = this.timeslotRepository.create({
      id: generateId('slot'),
      restaurant_id: dto.restaurant_id,
      slot_date: dto.slot_date,
      start_time: dto.start_time,
      end_time: dto.end_time,
    });

    const tables = this.tableRepository.findByRestaurantId(dto.restaurant_id);
    tables.forEach((table) => {
      this.tableSlotRepository.create({
        id: generateId('table_slot'),
        table_id: table.id,
        slot_id: slot.id,
        status: 'available',
      });
    });

    return {
      ...slot,
      date: slot.slot_date,
    };
  }

  update(id: string, dto: UpdateTimeSlotDto) {
    const existing = this.timeslotRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Time slot not found');
    }

    const nextRestaurantId = dto.restaurant_id ?? existing.restaurant_id;
    const nextDate = dto.slot_date ?? existing.slot_date;
    const nextStart = dto.start_time ?? existing.start_time;
    const nextEnd = dto.end_time ?? existing.end_time;

    this.validateTwoHourSlot(nextStart, nextEnd);
    this.validateNoOverlap(nextRestaurantId, nextDate, nextStart, nextEnd, id);

    const updated = this.timeslotRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Time slot not found');
    }

    return {
      ...updated,
      date: updated.slot_date,
    };
  }

  delete(id: string) {
    const existing = this.timeslotRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Time slot not found');
    }

    const hasActiveReservation = this.reservationRepository
      .findBySlotId(id)
      .some((reservation) =>
        reservation.reservation_status === 'reserved' ||
        reservation.reservation_status === 'checked_in',
      );
    if (hasActiveReservation) {
      throw new BadRequestException('Cannot delete a time slot with an active reservation');
    }

    this.timeslotRepository.remove(id);
    this.tableSlotRepository.removeBySlotId(id);
    return { deleted: true };
  }
}
