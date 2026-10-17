import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import { CreateTableDto, UpdateTableDto } from 'src/modules/tables/dto/tables.dto';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { reservationTableIds } from 'src/common/utils/reservation-tables.util';
import { slotInstant } from 'src/common/utils/india-time.util';
import { ScheduleRepository } from 'src/repositories/schedule.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';

@Injectable()
export class TablesService {
  constructor(
    private readonly tableRepository: TableRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly restaurantRepository: RestaurantRepository,
  ) {}

  private syncRestaurantTableCount(restaurantId: string) {
    this.restaurantRepository.update(restaurantId, {
      total_tables: this.tableRepository.findByRestaurantId(restaurantId).length,
    });
  }

  findAll(restaurantId?: string) {
    if (restaurantId) {
    return this.tableRepository.findByRestaurantId(restaurantId, true);
    }

    return this.tableRepository.findAll();
  }

  findOne(id: string) {
    const table = this.tableRepository.findById(id);
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  private futureReservationForTable(tableId: string, restaurantId: string) {
    return this.reservationRepository.findByRestaurantId(restaurantId).find((reservation) => {
      if (!['reserved', 'checked_in'].includes(reservation.reservation_status) || !reservationTableIds(reservation).includes(tableId)) return false;
      const slot = this.timeSlotRepository.findById(reservation.slot_id);
      return Boolean(slot && slotInstant(slot.slot_date, slot.start_time).valueOf() > Date.now());
    });
  }

  create(dto: CreateTableDto) {
    const existingSameNumber = this.tableRepository
      .findByRestaurantId(dto.restaurant_id)
      .find((table) => Number(table.table_number) === Number(dto.table_number));
    if (existingSameNumber) {
      const schedule = this.scheduleRepository.findByRestaurantId(dto.restaurant_id);
      const isInWeeklyDefault = Boolean(schedule?.default_table_layout?.some((entry) => entry.table_id === existingSameNumber.id));
      if (!isInWeeklyDefault) {
        const conflict = this.futureReservationForTable(existingSameNumber.id, dto.restaurant_id);
        if (conflict) throw new ConflictException(`Cannot reuse Table ${existingSameNumber.table_number}: future reservation ${conflict.id} is using it.`);
        const restored = this.tableRepository.update(existingSameNumber.id, { capacity: dto.capacity, status: 'active' })!;
        this.syncRestaurantTableCount(dto.restaurant_id);
        return restored;
      }
      throw new BadRequestException('Table number already exists for this restaurant');
    }

    // Deletion is a reversible deactivation because historical reservations keep
    // the old table id. Reusing the number must still be allowed after a
    // conflict-free deactivation, while active tables remain protected above.
    const inactiveSameNumber = this.tableRepository
      .findByRestaurantId(dto.restaurant_id, true)
      .find((table) => table.status === 'inactive' && Number(table.table_number) === Number(dto.table_number));
    if (inactiveSameNumber) {
      const conflict = this.futureReservationForTable(inactiveSameNumber.id, dto.restaurant_id);
      if (conflict) throw new ConflictException(`Cannot reuse Table ${inactiveSameNumber.table_number}: future reservation ${conflict.id} is using it.`);
      const restored = this.tableRepository.update(inactiveSameNumber.id, { capacity: dto.capacity, status: 'active' })!;
      this.syncRestaurantTableCount(dto.restaurant_id);
      return restored;
    }

    const table = this.tableRepository.create({
      id: generateId('table'),
      restaurant_id: dto.restaurant_id,
      table_number: dto.table_number,
      capacity: dto.capacity,
      status: 'active',
    });


    this.syncRestaurantTableCount(dto.restaurant_id);
    return table;
  }

  update(id: string, dto: UpdateTableDto) {
    const existing = this.tableRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Table not found');
    }

    if (this.timeSlotRepository.findByRestaurantId(existing.restaurant_id).some((slot)=>slot.layout_locked_at && slot.table_layout?.some((entry)=>entry.table_id===id))) {
      throw new BadRequestException('This table has a booked session. Change future session capacities in the dated layout instead.');
    }
    if (dto.status === 'inactive') {
      const conflict = this.futureReservationForTable(id, existing.restaurant_id);
      if (conflict) throw new ConflictException(`Cannot remove Table ${existing.table_number}: future reservation ${conflict.id} is using it.`);
    }
    if (dto.capacity !== undefined) {
      const conflict = this.reservationRepository.findByRestaurantId(existing.restaurant_id).find((reservation) => {
        if (!['reserved', 'checked_in'].includes(reservation.reservation_status) || !reservationTableIds(reservation).includes(id)) return false;
        const slot = this.timeSlotRepository.findById(reservation.slot_id);
        return Boolean(slot && slotInstant(slot.slot_date, slot.start_time) > Date.now() && dto.capacity! < reservation.guest_count);
      });
      if (conflict) throw new ConflictException(`Capacity change conflicts with future reservation ${conflict.id}.`);
    }
    if (dto.restaurant_id && dto.restaurant_id!==existing.restaurant_id) throw new BadRequestException('A table cannot be moved between restaurants.');
    const nextRestaurantId = dto.restaurant_id ?? existing.restaurant_id;
    const nextTableNumber = dto.table_number ?? existing.table_number;
    const conflict = this.tableRepository
      .findByRestaurantId(nextRestaurantId)
      .find(
        (table) =>
          table.id !== id && Number(table.table_number) === Number(nextTableNumber),
      );
    if (conflict) {
      throw new BadRequestException('Table number already exists for this restaurant');
    }

    const updated = this.tableRepository.update(id, { ...dto, status: dto.status ?? existing.status ?? 'active' });
    if (!updated) {
      throw new NotFoundException('Table not found');
    }

    if (dto.status !== undefined) this.syncRestaurantTableCount(existing.restaurant_id);

    return updated;
  }

  delete(id: string) {
    const table = this.tableRepository.findById(id);
    if (!table) throw new NotFoundException('Table not found');
    const conflict = this.futureReservationForTable(id, table.restaurant_id);
    if (conflict) throw new ConflictException(`Cannot remove Table ${table.table_number}: future reservation ${conflict.id} is using it.`);
    this.tableRepository.update(id, { status: 'inactive' });
    this.syncRestaurantTableCount(table.restaurant_id);
    return { deleted: false, deactivated: true, table_id: id };
  }
}
