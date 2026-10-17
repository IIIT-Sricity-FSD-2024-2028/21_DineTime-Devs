import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { TableSlot } from 'src/common/types/schema.types';
import { generateId } from 'src/common/utils/id.util';
import { UpdateTableSlotStatusDto } from 'src/modules/tableslots/dto/tableslots.dto';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { SchedulesService } from 'src/modules/schedules/schedules.service';

@Injectable()
export class TableslotsService {
  constructor(
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly schedules: SchedulesService,
  ) {}

  private reconcileWithReservations(entries: TableSlot[]): TableSlot[] {
    return entries.map((entry) => {
      const reservation = this.reservationRepository.findByTableAndSlot(entry.table_id, entry.slot_id);
      if (reservation) {
        const expectedStatus = reservation.reservation_status === 'checked_in' ? 'occupied' : 'reserved';
        if (entry.status !== expectedStatus) {
          return this.tableSlotRepository.updateStatus(entry.table_id, entry.slot_id, expectedStatus) || entry;
        }
        return entry;
      }

      const slot = this.timeSlotRepository.findById(entry.slot_id);
      if (slot && this.schedules.isTableBlocked(slot.restaurant_id, slot.slot_date, slot.start_time, slot.end_time, entry.table_id)) {
        return { ...entry, status: 'blocked', schedule_block: true };
      }

      if (entry.manual_status) return { ...entry, status: entry.manual_status };
      if (entry.status === 'blocked' || entry.manual_block) return { ...entry, status: 'blocked', manual_block: true };

      // Repair stale reservation statuses so they cannot leak into other dates or times.
      if (entry.status !== 'available') {
        return this.tableSlotRepository.updateStatus(entry.table_id, entry.slot_id, 'available') || entry;
      }
      return entry;
    });
  }

  findAll(restaurantId?: string, slotId?: string) {
    if (slotId) {
      return this.reconcileWithReservations(this.tableSlotRepository.findBySlotId(slotId));
    }

    if (!restaurantId) {
      return this.reconcileWithReservations(this.tableSlotRepository.findAll());
    }

    const tables = this.tableRepository.findByRestaurantId(restaurantId);
    const tableIds = new Set(tables.map((table) => table.id));
    return this.reconcileWithReservations(this.tableSlotRepository
      .findAll()
      .filter((slot) => tableIds.has(slot.table_id)));
  }

  getAvailability(restaurantId: string, slotId: string) {
    const slot = this.timeSlotRepository.findById(slotId);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    // A diner may have an old booking tab open when the manager closes or
    // overrides this service. Do not expose tables for a slot that is no
    // longer part of the effective schedule.
    if (!this.schedules.isSlotAllowed(restaurantId, slot.slot_date, slot.start_time, slot.end_time)) {
      return [];
    }

    const tables = this.tableRepository.findByRestaurantId(restaurantId);
    const tableIds = new Set(tables.map((table) => table.id));

    return this.reconcileWithReservations(this.tableSlotRepository
      .findBySlotId(slotId)
      .filter((item) => tableIds.has(item.table_id)));
  }

  seedRestaurantSlots(restaurantId: string) {
    const tables = this.tableRepository.findByRestaurantId(restaurantId);
    const slots = this.timeSlotRepository.findByRestaurantId(restaurantId);
    const created: TableSlot[] = [];

    tables.forEach((table) => {
      slots.forEach((slot) => {
        const existing = this.tableSlotRepository.findByTableAndSlot(table.id, slot.id);
        if (!existing) {
          created.push(
            this.tableSlotRepository.create({
              id: generateId('table_slot'),
              table_id: table.id,
              slot_id: slot.id,
              status: 'available',
            }),
          );
        }
      });
    });

    return created;
  }

  updateStatus(dto: UpdateTableSlotStatusDto, actingRole?: Role) {
    const table = this.tableRepository.findById(dto.table_id);
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const slot = this.timeSlotRepository.findById(dto.slot_id);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    if (table.restaurant_id !== slot.restaurant_id) {
      throw new BadRequestException('Table and time slot belong to different restaurants');
    }

    if (slot.table_layout && !slot.table_layout.some((entry) => entry.table_id === table.id)) {
      throw new BadRequestException('This table is not in the selected service layout');
    }

    const existing = this.tableSlotRepository.findByTableAndSlot(
      dto.table_id,
      dto.slot_id,
    );
    const current = existing ? this.reconcileWithReservations([existing])[0] : undefined;
    if (actingRole === Role.STAFF) {
      if (current && ['reserved', 'occupied'].includes(current.status)) {
        throw new ForbiddenException('Reserved and occupied tables are managed by reservations.');
      }
      if (!['available', 'blocked'].includes(dto.status)) {
        throw new ForbiddenException('Staff can only set a table to available or blocked.');
      }
    }

    const reservation = this.reservationRepository.findByTableAndSlot(dto.table_id, dto.slot_id);
    if (reservation) {
      const expected = reservation.reservation_status === 'checked_in' ? 'occupied' : 'reserved';
      if (dto.status !== expected) {
        throw new BadRequestException(expected === 'occupied'
          ? 'This table has a checked-in diner. Complete the reservation before releasing it.'
          : 'This table has a reservation. Use Customer Check-In to seat the diner, or cancel the booking before blocking or releasing it.');
      }
    }

    if (this.schedules.isTableBlocked(slot.restaurant_id, slot.slot_date, slot.start_time, slot.end_time, table.id)) {
      throw new BadRequestException('This table is blocked by the manager schedule. Ask the manager to remove that block.');
    }

    if (!existing) {
      return this.tableSlotRepository.create({
        id: generateId('table_slot'),
        table_id: dto.table_id,
        slot_id: dto.slot_id,
        status: dto.status,
        ...(dto.status !== 'available' ? { manual_status: dto.status } : {}),
        ...(dto.status === 'blocked' ? { manual_block: true } : {}),
      });
    }

    const updated = reservation
      ? this.tableSlotRepository.updateStatus(dto.table_id, dto.slot_id, dto.status)
      : this.tableSlotRepository.setManualStatus(dto.table_id, dto.slot_id, dto.status);

    if (!updated) {
      throw new NotFoundException('Table slot not found');
    }

    return updated;
  }
}
