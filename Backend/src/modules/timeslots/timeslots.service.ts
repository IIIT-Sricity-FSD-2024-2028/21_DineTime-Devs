import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import { slotRange } from 'src/common/utils/india-time.util';
import { TimeSlot } from 'src/common/types/schema.types';
import { CreateTimeSlotDto, UpdateTimeSlotDto, SaveSlotLayoutDto } from './dto/timeslots.dto';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { withinOperatingHours } from 'src/common/utils/operating-hours.util';
import { reservationTableIds } from 'src/common/utils/reservation-tables.util';

@Injectable()
export class TimeslotsService {
  constructor(private readonly timeslotRepository: TimeSlotRepository, private readonly tableRepository: TableRepository,
    private readonly tableSlotRepository: TableSlotRepository, private readonly reservationRepository: ReservationRepository,
    private readonly restaurants: RestaurantRepository, private readonly schedule: SchedulesService) {}
  private booked(slot: TimeSlot) {
    return Boolean(slot.layout_locked_at || this.reservationRepository.findAll().some((r) => (r.slot_id === slot.id && (!r.hold_expires_at || r.confirmed_at)) || r.modification_history?.some((h)=>h.slot_id===slot.id)));
  }
  private decorate(slot: TimeSlot) {
    const restaurant = this.restaurants.findById(slot.restaurant_id);
    const effective = this.schedule.effectiveForDate(slot.restaurant_id, slot.slot_date);
    const activeReservations = this.reservationRepository.findBySlotId(slot.id).filter((reservation) => ['reserved', 'checked_in'].includes(reservation.reservation_status));
    return {...slot,date:slot.slot_date,locked:this.booked(slot),revision:slot.revision || 0,
      reservation_count: activeReservations.length,
      reserved_table_ids: [...new Set(activeReservations.flatMap(reservationTableIds))],
      within_operating_hours: Boolean(restaurant && withinOperatingHours(slot.start_time, slot.end_time, { opens_at: effective.open_time, closes_at: effective.close_time })),
      schedule_allowed: this.schedule.isSlotAllowed(slot.restaurant_id, slot.slot_date, slot.start_time, slot.end_time),
      schedule_closed: effective.is_closed};
  }
  private editable(slot: TimeSlot, revision?: number) {
    if (this.booked(slot)) throw new ConflictException('This session is locked because it has a reservation. Its tables and timing cannot be changed.');
    if(this.reservationRepository.findBySlotId(slot.id).some(r=>r.reservation_status==='reserved' && r.hold_expires_at && Date.parse(r.hold_expires_at)>Date.now()))throw new ConflictException('A guest is completing payment. Try editing after their hold ends.');
    if (slotRange(slot.slot_date,slot.start_time,slot.end_time).from <= Date.now()) throw new BadRequestException('Past or started sessions cannot be edited.');
    if (revision !== undefined && revision !== (slot.revision || 0)) throw new ConflictException('This session changed while you were editing. Reload its latest details.');
  }
  private editableLayout(slot: TimeSlot, revision?: number) {
    if (this.reservationRepository.findBySlotId(slot.id).some(r => r.reservation_status === 'reserved' && r.hold_expires_at && Date.parse(r.hold_expires_at) > Date.now())) {
      throw new ConflictException('A guest is completing payment. Try editing after their hold ends.');
    }
    if (slotRange(slot.slot_date, slot.start_time, slot.end_time).from <= Date.now()) throw new BadRequestException('Past or started sessions cannot be edited.');
    if (revision !== undefined && revision !== (slot.revision || 0)) throw new ConflictException('This session changed while you were editing. Reload its latest details.');
  }
  private assertBookedTablesUnchanged(slot: TimeSlot, layout: Array<{ table_id: string; capacity: number; x?: number; y?: number; shape?: string }>) {
    const current = new Map((slot.table_layout || []).map((entry, index) => [entry.table_id, { ...entry, x: entry.x ?? (index % 4) * 2, y: entry.y ?? Math.floor(index / 4) * 2, shape: entry.shape || 'square' }]));
    const next = new Map(layout.map((entry) => [entry.table_id, entry]));
    const reservations = this.reservationRepository.findBySlotId(slot.id)
      .filter((reservation) => ['reserved', 'checked_in'].includes(reservation.reservation_status));
    for (const reservation of reservations) {
      for (const tableId of reservationTableIds(reservation)) {
        const previous = current.get(tableId);
        const candidate = next.get(tableId);
        if (!candidate) throw new ConflictException(`Table ${previous?.table_number || tableId} is booked for this session and cannot be removed.`);
        if (previous && (candidate.capacity !== previous.capacity || (candidate.x !== undefined && candidate.x !== previous.x) || (candidate.y !== undefined && candidate.y !== previous.y) || (candidate.shape || 'square') !== previous.shape)) {
          throw new ConflictException(`Table ${previous.table_number} is booked for this session and cannot be modified.`);
        }
      }
    }
  }
  private validate(restaurantId: string, date: string, start: string, end: string, excludeId?: string) {
    const range = slotRange(date,start,end);
    const requestedMinutes = (range.to - range.from) / 60000;
    if (range.from <= Date.now()) throw new BadRequestException('Choose an upcoming date and time in Bengaluru.');
    const restaurant = this.restaurants.findById(restaurantId);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const effective = this.schedule.effectiveForDate(restaurantId, date);
    if (effective.is_closed) throw new BadRequestException('The restaurant is closed on this date.');
    if (requestedMinutes !== effective.slot_duration_minutes) throw new BadRequestException(`Time slot must be ${effective.slot_duration_minutes} minutes on this day.`);
    if (!withinOperatingHours(start, end, { opens_at: effective.open_time, closes_at: effective.close_time }) || !this.schedule.isSlotAllowed(restaurantId, date, start, end)) throw new BadRequestException('The complete session must fit within the applicable opening hours and schedule rules.');
    for (const slot of this.timeslotRepository.findByRestaurantId(restaurantId)) {
      if (slot.id === excludeId) continue;
      const other = slotRange(slot.slot_date,slot.start_time,slot.end_time);
      if (range.from < other.to && other.from < range.to) throw new BadRequestException('Time slot overlaps an existing session, including overnight sessions.');
    }
  }
  findAll(restaurantId?:string,date?:string,forDiner=false) {
    // The diner endpoint does not send a restaurant filter: it loads the
    // discovery list for every restaurant. Materialize each current schedule
    // before reading that list so manager changes are visible immediately.
    const restaurantIds = restaurantId
      ? [restaurantId]
      : [...new Set(this.restaurants.findAll().map((restaurant) => restaurant.id))];
    restaurantIds.forEach((id) => this.schedule.materialize(id));
    return (restaurantId ? this.timeslotRepository.findByRestaurantId(restaurantId) : this.timeslotRepository.findAll())
      .filter((slot)=>!date || slot.slot_date===date).map((slot)=>this.decorate(slot))
      .filter((slot)=>!forDiner || slot.schedule_allowed);
  }
  findOne(id: string) {
    const slot = this.timeslotRepository.findById(id);
    if (!slot) throw new NotFoundException('Time slot not found');
    return this.decorate(slot);
  }
  create(dto: CreateTimeSlotDto) {
    this.validate(dto.restaurant_id,dto.slot_date,dto.start_time,dto.end_time);
    const layout = this.tableRepository.findByRestaurantId(dto.restaurant_id).map((table)=>({table_id:table.id,table_number:table.table_number,capacity:table.capacity}));
    const slot = this.timeslotRepository.create({id:generateId('slot'),...dto,table_layout:layout,published:false,revision:0});
    layout.forEach((table)=>this.tableSlotRepository.create({id:generateId('table_slot'),table_id:table.table_id,slot_id:slot.id,status:'available'}));
    return this.decorate(slot);
  }
  update(id:string,dto:UpdateTimeSlotDto) {
    const slot = this.timeslotRepository.findById(id);
    if (!slot) throw new NotFoundException('Time slot not found');
    this.editable(slot,dto.revision);
    if (dto.restaurant_id && dto.restaurant_id!==slot.restaurant_id) throw new BadRequestException('A session cannot be moved to another restaurant.');
    this.validate(slot.restaurant_id,dto.slot_date || slot.slot_date,dto.start_time || slot.start_time,dto.end_time || slot.end_time,id);
    const {revision,...values}=dto;
    this.timeslotRepository.update(id,{...values,revision:(slot.revision || 0)+1});
    return this.decorate(slot);
  }
  saveLayout(id:string,dto:SaveSlotLayoutDto) {
    const slot = this.timeslotRepository.findById(id);
    if (!slot) throw new NotFoundException('Time slot not found');
    this.editableLayout(slot,dto.revision);
    if (new Set(dto.tables.map((t)=>t.table_id)).size!==dto.tables.length) throw new BadRequestException('Choose tables without duplicates.');
    const layout = dto.tables.map((entry,index)=>{
      const table=this.tableRepository.findById(entry.table_id);
      if (!table || table.restaurant_id!==slot.restaurant_id) throw new BadRequestException('Choose tables belonging to this restaurant.');
      return {table_id:table.id,table_number:table.table_number,capacity:entry.capacity,x:entry.x ?? index%8,y:entry.y ?? Math.floor(index/8),shape:entry.shape || 'square'};
    });
    if (new Set(layout.map(entry=>`${entry.x},${entry.y}`)).size !== layout.length) throw new BadRequestException('Two tables cannot occupy the same floor-plan position.');
    this.assertBookedTablesUnchanged(slot, layout);
    const previous = this.tableSlotRepository.findBySlotId(id);
    this.tableSlotRepository.removeBySlotId(id);
    layout.forEach((entry)=>{
      const allocation = previous.find((item)=>item.table_id===entry.table_id);
      this.tableSlotRepository.create(allocation || {id:generateId('table_slot'),table_id:entry.table_id,slot_id:id,status:'available'});
    });
    this.timeslotRepository.update(id,{table_layout:layout,published:true,layout_override:true,revision:(slot.revision || 0)+1});
    return this.decorate(slot);
  }
  resetLayout(id:string, revision:number) {
    const slot = this.timeslotRepository.findById(id);
    if (!slot) throw new NotFoundException('Time slot not found');
    this.editableLayout(slot, revision);
    const layout = this.schedule.get(slot.restaurant_id).default_table_layout || [];
    this.assertBookedTablesUnchanged(slot, layout);
    const previous = this.tableSlotRepository.findBySlotId(id);
    this.tableSlotRepository.removeBySlotId(id);
    layout.forEach((entry)=>{
      const allocation = previous.find((item)=>item.table_id===entry.table_id);
      this.tableSlotRepository.create(allocation || {id:generateId('table_slot'),table_id:entry.table_id,slot_id:id,status:'available'});
    });
    this.timeslotRepository.update(id,{table_layout:layout.map((entry)=>({...entry})),published:true,layout_override:false,revision:(slot.revision || 0)+1});
    return this.decorate(slot);
  }
  delete(id:string) {
    const slot=this.timeslotRepository.findById(id);
    if (!slot) throw new NotFoundException('Time slot not found');
    this.editable(slot);
    this.timeslotRepository.remove(id);this.tableSlotRepository.removeBySlotId(id);
    return {deleted:true};
  }
}
