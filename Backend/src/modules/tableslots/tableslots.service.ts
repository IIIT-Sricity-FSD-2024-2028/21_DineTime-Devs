import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TableSlot } from 'src/common/types/schema.types';
import { generateId } from 'src/common/utils/id.util';
import { UpdateTableSlotStatusDto } from 'src/modules/tableslots/dto/tableslots.dto';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';

@Injectable()
export class TableslotsService {
  constructor(
    private readonly tableSlotRepository: TableSlotRepository,
    private readonly tableRepository: TableRepository,
    private readonly timeSlotRepository: TimeSlotRepository,
  ) {}

  findAll(restaurantId?: string, slotId?: string) {
    if (slotId) {
      return this.tableSlotRepository.findBySlotId(slotId);
    }

    if (!restaurantId) {
      return this.tableSlotRepository.findAll();
    }

    const tables = this.tableRepository.findByRestaurantId(restaurantId);
    const tableIds = new Set(tables.map((table) => table.id));
    return this.tableSlotRepository
      .findAll()
      .filter((slot) => tableIds.has(slot.table_id));
  }

  getAvailability(restaurantId: string, slotId: string) {
    const slot = this.timeSlotRepository.findById(slotId);
    if (!slot) {
      throw new NotFoundException('Time slot not found');
    }

    const tables = this.tableRepository.findByRestaurantId(restaurantId);
    const tableIds = new Set(tables.map((table) => table.id));

    return this.tableSlotRepository
      .findBySlotId(slotId)
      .filter((item) => tableIds.has(item.table_id));
  }

  seedRestaurantSlots(restaurantId: string) {
    const tables = this.tableRepository.findByRestaurantId(restaurantId);
    const slots = this.timeSlotRepository.findByRestaurantId(restaurantId);
    const created: TableSlot[] = [];

    tables.forEach((table) => {
      slots.forEach((slot) => {
        created.push(
          this.tableSlotRepository.create({
            id: generateId('table_slot'),
            table_id: table.id,
            slot_id: slot.id,
            status: 'available',
          }),
        );
      });
    });

    return created;
  }

  updateStatus(dto: UpdateTableSlotStatusDto) {
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

    const existing = this.tableSlotRepository.findByTableAndSlot(
      dto.table_id,
      dto.slot_id,
    );

    if (!existing) {
      return this.tableSlotRepository.create({
        id: generateId('table_slot'),
        table_id: dto.table_id,
        slot_id: dto.slot_id,
        status: dto.status,
      });
    }

    const updated = this.tableSlotRepository.updateStatus(
      dto.table_id,
      dto.slot_id,
      dto.status,
    );

    if (!updated) {
      throw new NotFoundException('Table slot not found');
    }

    return updated;
  }
}
