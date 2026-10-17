import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { generateId } from 'src/common/utils/id.util';
import { indiaToday, slotInstant, slotRange } from 'src/common/utils/india-time.util';
import { withinOperatingHours } from 'src/common/utils/operating-hours.util';
import { RestaurantSchedule, ScheduleRule, TableLayoutEntry, WeeklyScheduleDay } from 'src/common/types/schema.types';
import { ReservationRepository } from 'src/repositories/reservation.repository';
import { RestaurantRepository } from 'src/repositories/restaurant.repository';
import { ScheduleRepository } from 'src/repositories/schedule.repository';
import { TableRepository } from 'src/repositories/table.repository';
import { TableSlotRepository } from 'src/repositories/tableslot.repository';
import { TimeSlotRepository } from 'src/repositories/timeslot.repository';
import { CreateScheduleRuleDto, DefaultLayoutTableDto, UpdateDateScheduleDto, UpdateWeeklyScheduleDto } from './dto/schedules.dto';
import { reservationTableIds } from 'src/common/utils/reservation-tables.util';

const DAY_MS = 86400000;
const ROLLING_HORIZON_DAYS = 7;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekdayOf(date: string) {
  const value = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!Number.isFinite(value)) throw new BadRequestException('Enter a valid calendar date.');
  return value;
}

function minutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new BadRequestException('Times must use HH:MM format.');
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function timeAt(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  const a = slotRange('2030-01-01', startA, endA);
  const b = slotRange('2030-01-01', startB, endB);
  return a.from < b.to && b.from < a.to;
}

function sameSlot(a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }) {
  return a.start_time === b.start_time && a.end_time === b.end_time;
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly restaurants: RestaurantRepository,
    private readonly tables: TableRepository,
    private readonly slots: TimeSlotRepository,
    private readonly allocations: TableSlotRepository,
    private readonly reservations: ReservationRepository,
  ) {}

  private defaultWeekly(restaurantId: string): WeeklyScheduleDay[] {
    const restaurant = this.restaurants.findById(restaurantId);
    const open = restaurant?.opens_at || '11:00';
    const close = restaurant?.closes_at || '23:00';
    return Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_closed: false,
      open_time: open,
      close_time: close,
      slot_duration_minutes: 120,
      buffer_minutes: 0,
      slots: [],
    }));
  }

  private defaultLayout(restaurantId: string): TableLayoutEntry[] {
    return this.tables.findByRestaurantId(restaurantId).map((table, index) => ({
      table_id: table.id,
      table_number: table.table_number,
      capacity: table.capacity,
      x: (index % 4) * 2,
      y: Math.floor(index / 4) * 2,
      shape: 'square',
    }));
  }

  ensure(restaurantId: string): RestaurantSchedule {
    const restaurant = this.restaurants.findById(restaurantId);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const existing = this.schedules.findByRestaurantId(restaurantId);
    if (existing) {
      const activeTables = this.tables.findByRestaurantId(restaurantId);
      const activeIds = new Set(activeTables.map((table) => table.id));
      if (existing.default_table_layout?.length) existing.default_table_layout = existing.default_table_layout.filter((entry) => activeIds.has(entry.table_id));
      if (!existing.default_table_layout && activeTables.length) existing.default_table_layout = this.defaultLayout(restaurantId);
      if (existing.managed === false || existing.managed === undefined) existing.managed = true;
      return existing;
    }
    const now = new Date().toISOString();
    const existingSlots = this.slots.findByRestaurantId(restaurantId);
    const existingWindows = [...new Map(existingSlots.map((slot) => [`${slot.start_time}-${slot.end_time}`, { start_time: slot.start_time, end_time: slot.end_time }])).values()];
    const weekly = this.defaultWeekly(restaurantId).map((day) => existingWindows.length ? { ...day, slots: existingWindows.map((slot) => ({ ...slot })) } : day);
    return this.schedules.create({
      id: generateId('schedule'), restaurant_id: restaurantId,
      weekly, default_table_layout: this.defaultLayout(restaurantId), rules: [], created_at: now, updated_at: now,
      managed: true, configured: existingSlots.length > 0,
    });
  }

  get(restaurantId: string) {
    const schedule = this.ensure(restaurantId);
    if (!schedule.default_table_layout || schedule.managed !== true) {
      this.schedules.update(restaurantId, { default_table_layout: schedule.default_table_layout || this.defaultLayout(restaurantId), managed: true, updated_at: new Date().toISOString() });
    }
    if (schedule.configured === false) return schedule;
    this.materialize(restaurantId);
    return schedule;
  }

  private validateWeekly(weekly: WeeklyScheduleDay[]) {
    if (weekly.length !== 7 || new Set(weekly.map((day) => day.weekday)).size !== 7) {
      throw new BadRequestException('Provide exactly one schedule for every weekday.');
    }
    weekly.forEach((day) => {
      if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
        throw new BadRequestException('Weekday must be between Sunday and Saturday.');
      }
      minutes(day.open_time); minutes(day.close_time);
      const slots = day.slots || [];
      if (new Set(slots.map((slot) => `${slot.start_time}-${slot.end_time}`)).size !== slots.length) {
        throw new BadRequestException(`${DAY_NAMES[day.weekday]} contains duplicate time slots.`);
      }
      slots.forEach((slot) => {
        minutes(slot.start_time); minutes(slot.end_time);
        const length = (minutes(slot.end_time) - minutes(slot.start_time) + 1440) % 1440 || 1440;
        if (length !== day.slot_duration_minutes) throw new BadRequestException(`${DAY_NAMES[day.weekday]} Slot ${slot.start_time} must be ${day.slot_duration_minutes} minutes long.`);
      });
      for (let index = 0; index < slots.length; index += 1) {
        if (!withinOperatingHours(slots[index].start_time, slots[index].end_time, { opens_at: day.open_time, closes_at: day.close_time })) {
          throw new BadRequestException(`${DAY_NAMES[day.weekday]} has a slot outside opening hours.`);
        }
        for (let next = index + 1; next < slots.length; next += 1) {
          if (overlaps(slots[index].start_time, slots[index].end_time, slots[next].start_time, slots[next].end_time)) {
            throw new BadRequestException(`${DAY_NAMES[day.weekday]} contains overlapping time slots.`);
          }
        }
      }
      if (!day.is_closed) {
        const duration = (minutes(day.close_time) - minutes(day.open_time) + 1440) % 1440 || 1440;
        if (duration < day.slot_duration_minutes) throw new BadRequestException(`${DAY_NAMES[day.weekday]} must allow at least one complete slot.`);
      }
      if (day.slot_duration_minutes + day.buffer_minutes > 1440) throw new BadRequestException('Slot duration and buffer are too long.');
    });
  }

  private validateSlotList(slots: { start_time: string; end_time: string }[], open: string, close: string, closed: boolean, slotDuration: number, label: string) {
    if (closed && slots.length) throw new BadRequestException(`${label} is closed and cannot contain time slots.`);
    const seen = new Set(slots.map((slot) => `${slot.start_time}-${slot.end_time}`));
    if (seen.size !== slots.length) throw new BadRequestException(`${label} contains duplicate time slots.`);
    slots.forEach((slot) => {
      minutes(slot.start_time); minutes(slot.end_time);
      const length = (minutes(slot.end_time) - minutes(slot.start_time) + 1440) % 1440 || 1440;
      if (length !== slotDuration) throw new BadRequestException(`${label} Slot ${slot.start_time} must be ${slotDuration} minutes long.`);
      if (!withinOperatingHours(slot.start_time, slot.end_time, { opens_at: open, closes_at: close })) throw new BadRequestException(`${label} has a slot outside opening hours.`);
    });
    for (let index = 0; index < slots.length; index += 1) {
      for (let next = index + 1; next < slots.length; next += 1) {
        if (overlaps(slots[index].start_time, slots[index].end_time, slots[next].start_time, slots[next].end_time)) throw new BadRequestException(`${label} contains overlapping time slots.`);
      }
    }
  }

  private matches(rule: ScheduleRule, date: string) {
    if (!rule.start_date || date < rule.start_date) return false;
    return date === rule.start_date;
  }

  private specificity(rule: ScheduleRule) {
    return rule.scope === 'date' ? 3 : 0;
  }

  effectiveForDate(restaurantId: string, date: string, schedule = this.ensure(restaurantId)) {
    const weekday = weekdayOf(date);
    const base = schedule.date_overrides?.[date] || schedule.weekly.find((day) => day.weekday === weekday) || this.defaultWeekly(restaurantId)[weekday];
    const matching = schedule.rules.filter((rule) => this.matches(rule, date));
    const hours = matching.filter((rule) => rule.type === 'hours').sort((a, b) => this.specificity(b) - this.specificity(a))[0];
    const closed = matching.some((rule) => rule.type === 'closure');
    const effective = {
      ...base,
      is_closed: base.is_closed || closed,
      open_time: hours?.open_time || base.open_time,
      close_time: hours?.close_time || base.close_time,
    };
    return { ...effective, rules: matching };
  }

  isTableBlocked(restaurantId: string, date: string, start: string, end: string, tableId: string, schedule?: RestaurantSchedule) {
    const effective = this.effectiveForDate(restaurantId, date, schedule);
    return effective.rules.some((rule) => rule.type === 'table_block' && rule.table_ids?.includes(tableId) &&
      (!rule.start_time || !rule.end_time || overlaps(start, end, rule.start_time, rule.end_time)));
  }

  isSlotAllowed(restaurantId: string, date: string, start: string, end: string, schedule?: RestaurantSchedule) {
    const effective = this.effectiveForDate(restaurantId, date, schedule);
    if (effective.is_closed || !withinOperatingHours(start, end, { opens_at: effective.open_time, closes_at: effective.close_time })) return false;
    const durationMinutes = (slotRange(date, start, end).to - slotRange(date, start, end).from) / 60000;
    const explicitAddition = effective.rules.some((rule) => rule.type === 'slot' && rule.slot_action === 'add' && rule.start_time === start && rule.end_time === end);
    const explicitWeeklySlot = effective.slots?.some((slot) => sameSlot(slot, { start_time: start, end_time: end }));
    // Once a manager defines explicit weekly slots, those windows are the
    // complete schedule. Do not let legacy/generated/manual records with the
    // right duration leak into the diner list.
    if (Array.isArray(effective.slots)) {
      if (!explicitWeeklySlot && !explicitAddition) return false;
    } else if (!explicitAddition && durationMinutes !== effective.slot_duration_minutes) {
      return false;
    }
    const removed = !explicitAddition && effective.rules.some((rule) => rule.type === 'slot' && rule.slot_action === 'remove' && rule.start_time && rule.end_time && overlaps(start, end, rule.start_time, rule.end_time));
    return !removed;
  }

  private assertNoConflicts(restaurantId: string, schedule: RestaurantSchedule) {
    const now = Date.now();
    for (const reservation of this.reservations.findByRestaurantId(restaurantId)) {
      if (!['reserved', 'checked_in'].includes(reservation.reservation_status)) continue;
      const slot = this.slots.findById(reservation.slot_id);
      if (!slot) continue;
      if (slotRange(slot.slot_date, slot.start_time, slot.end_time).to <= now && reservation.reservation_status !== 'checked_in') continue;
      if (!this.isSlotAllowed(restaurantId, slot.slot_date, slot.start_time, slot.end_time, schedule)) {
        throw new ConflictException(`This change conflicts with reservation ${reservation.id} on ${slot.slot_date} at ${slot.start_time}.`);
      }
      const tableIds = reservationTableIds(reservation);
      if (tableIds.some((tableId) => this.isTableBlocked(restaurantId, slot.slot_date, slot.start_time, slot.end_time, tableId, schedule))) {
        throw new ConflictException(`This change blocks table used by reservation ${reservation.id} on ${slot.slot_date} at ${slot.start_time}.`);
      }
    }
  }

  updateWeekly(restaurantId: string, dto: UpdateWeeklyScheduleDto) {
    const current = this.ensure(restaurantId);
    this.validateWeekly(dto.weekly as WeeklyScheduleDay[]);
    const dateOverrides = { ...current.date_overrides };
    for (const reservation of this.reservations.findByRestaurantId(restaurantId)) {
      if (!['reserved', 'checked_in'].includes(reservation.reservation_status)) continue;
      const slot = this.slots.findById(reservation.slot_id);
      if (!slot || (slotRange(slot.slot_date, slot.start_time, slot.end_time).to <= Date.now() && reservation.reservation_status !== 'checked_in')) continue;
      if (!dateOverrides[slot.slot_date]) {
        const base = current.weekly.find((day) => day.weekday === weekdayOf(slot.slot_date))!;
        dateOverrides[slot.slot_date] = structuredClone(base);
      }
    }
    const candidate = { ...current, date_overrides: dateOverrides, weekly: dto.weekly as WeeklyScheduleDay[], managed: true, configured: true, updated_at: new Date().toISOString() };
    this.assertNoConflicts(restaurantId, candidate);
    this.schedules.update(restaurantId, candidate);
    const representative = candidate.weekly.find((day) => day.weekday === 1 && !day.is_closed) || candidate.weekly.find((day) => !day.is_closed);
    if (representative) this.restaurants.update(restaurantId, { opens_at: representative.open_time, closes_at: representative.close_time });
    this.materialize(restaurantId);
    return this.get(restaurantId);
  }

  updateDate(restaurantId: string, dto: UpdateDateScheduleDto) {
    const current = this.ensure(restaurantId);
    if (dto.start_date < indiaToday()) throw new BadRequestException('Changes can only affect today or future dates.');
    const weekday = weekdayOf(dto.start_date);
    const base = current.weekly.find((day) => day.weekday === weekday) || this.defaultWeekly(restaurantId)[weekday];
    const slots = (dto.slots || []).map((slot) => ({ start_time: slot.start_time, end_time: slot.end_time }));
    minutes(dto.open_time); minutes(dto.close_time);
    const dateBase = current.date_overrides?.[dto.start_date] || base;
    this.validateSlotList(slots, dto.open_time, dto.close_time, dto.is_closed, dateBase.slot_duration_minutes, `Date ${dto.start_date}`);

    const weeklyOnlySchedule = { ...current, date_overrides: { [dto.start_date]: dateBase }, rules: [] };
    const weeklySlots = this.windowsForDate(restaurantId, dto.start_date, weeklyOnlySchedule);
    const weeklySet = new Set(weeklySlots.map((slot) => `${slot.start}-${slot.end}`));
    const desiredSet = new Set(slots.map((slot) => `${slot.start_time}-${slot.end_time}`));
    const rules: ScheduleRule[] = current.rules.filter((rule) => !(rule.scope === 'date' && rule.start_date === dto.start_date));
    const createdAt = new Date().toISOString();
    const ruleBase = { restaurant_id: restaurantId, scope: 'date' as const, start_date: dto.start_date, reason: dto.reason, created_at: createdAt };
    if (dto.is_closed) {
      rules.push({ ...ruleBase, id: generateId('schedule_rule'), type: 'closure' });
    } else {
      if (dto.open_time !== dateBase.open_time || dto.close_time !== dateBase.close_time) rules.push({ ...ruleBase, id: generateId('schedule_rule'), type: 'hours', open_time: dto.open_time, close_time: dto.close_time });
      weeklySlots.filter((slot) => !desiredSet.has(`${slot.start}-${slot.end}`)).forEach((slot) => rules.push({ ...ruleBase, id: generateId('schedule_rule'), type: 'slot', start_time: slot.start, end_time: slot.end, slot_action: 'remove' }));
      slots.filter((slot) => !weeklySet.has(`${slot.start_time}-${slot.end_time}`)).forEach((slot) => rules.push({ ...ruleBase, id: generateId('schedule_rule'), type: 'slot', start_time: slot.start_time, end_time: slot.end_time, slot_action: 'add' }));
    }
    const candidate = { ...current, rules, date_overrides: { ...current.date_overrides, [dto.start_date]: structuredClone(dateBase) }, managed: true, configured: true, updated_at: createdAt };
    this.assertNoConflicts(restaurantId, candidate);
    this.schedules.update(restaurantId, candidate);
    this.materialize(restaurantId);
    return this.get(restaurantId);
  }

  updateDefaultLayout(restaurantId: string, layout: DefaultLayoutTableDto[]) {
    const current = this.ensure(restaurantId);
    if (new Set(layout.map((entry) => entry.table_id)).size !== layout.length) throw new BadRequestException('A table can appear only once in the weekly default layout.');
    const normalized: TableLayoutEntry[] = layout.map((entry) => {
      const table = this.tables.findById(entry.table_id);
      if (!table || table.restaurant_id !== restaurantId || table.status === 'inactive') throw new BadRequestException('All default layout tables must belong to this restaurant and be active.');
      return { table_id: table.id, table_number: table.table_number, capacity: entry.capacity, x: entry.x, y: entry.y, shape: entry.shape || 'square' };
    });
    // A weekly template can change freely. Booked services retain their own
    // layout until the manager explicitly reverts them with conflict checks.
    for (const slot of this.slots.findByRestaurantId(restaurantId)) {
      if (this.reservations.findBySlotId(slot.id).some((reservation) => ['reserved', 'checked_in'].includes(reservation.reservation_status))) {
        this.slots.update(slot.id, { table_layout: structuredClone(slot.table_layout || current.default_table_layout || []), layout_override: true });
      }
    }
    const candidate = { ...current, default_table_layout: normalized, managed: true, updated_at: new Date().toISOString() };
    normalized.forEach((entry) => this.tables.update(entry.table_id, { capacity: entry.capacity }));
    this.schedules.update(restaurantId, candidate);
    this.syncGeneratedLayouts(restaurantId, candidate);
    this.materialize(restaurantId);
    return this.get(restaurantId);
  }

  createRule(restaurantId: string, dto: CreateScheduleRuleDto) {
    const current = this.ensure(restaurantId);
    if (dto.scope !== 'date' || !dto.start_date) throw new BadRequestException('Changes require one selected date.');
    if (['hours'].includes(dto.type) && (!dto.open_time || !dto.close_time)) throw new BadRequestException('Hours rules require opening and closing times.');
    if (dto.type === 'slot' && (!dto.start_time || !dto.end_time || !dto.slot_action)) throw new BadRequestException('Slot rules require a time interval and add/remove action.');
    if (dto.type === 'table_block') {
      if (!dto.table_ids?.length) throw new BadRequestException('Select at least one table to block.');
      dto.table_ids.forEach((tableId) => {
        const table = this.tables.findById(tableId);
        if (!table || table.restaurant_id !== restaurantId) throw new BadRequestException('All selected tables must belong to this restaurant.');
      });
    }
    if (dto.start_time) minutes(dto.start_time);
    if (dto.end_time) minutes(dto.end_time);
    if (dto.open_time) minutes(dto.open_time);
    if (dto.close_time) minutes(dto.close_time);
    if (dto.start_date < indiaToday()) throw new BadRequestException('Changes can only affect today or future dates.');
    const weekday = weekdayOf(dto.start_date);
    if (dto.type === 'slot' && dto.start_time && dto.end_time) {
      const base = current.weekly.find((day) => day.weekday === weekday) || this.defaultWeekly(restaurantId)[weekday];
      const length = (minutes(dto.end_time) - minutes(dto.start_time) + 1440) % 1440 || 1440;
      if (length !== base.slot_duration_minutes) throw new BadRequestException(`Slot ${dto.start_time} must be ${base.slot_duration_minutes} minutes long.`);
    }
    const rule: ScheduleRule = { ...dto, id: generateId('schedule_rule'), restaurant_id: restaurantId, created_at: new Date().toISOString() };
    // A date has one effective holiday/hours override. Re-saving either replaces
    // the previous value instead of leaving an older rule to win by array order.
    const rules = current.rules.filter((existing) => {
      if (existing.scope !== 'date' || existing.start_date !== dto.start_date) return true;
      if (dto.type === 'closure') return false;
      if (dto.type === 'hours' && existing.type === 'closure') return false;
      if (existing.type !== dto.type) return true;
      if (dto.type !== 'slot') return false;
      return !(existing.start_time === dto.start_time && existing.end_time === dto.end_time);
    });
    const candidate = { ...current, rules: [...rules, rule], managed: true, configured: true, updated_at: new Date().toISOString() };
    this.assertNoConflicts(restaurantId, candidate);
    this.schedules.update(restaurantId, candidate);
    this.materialize(restaurantId);
    return rule;
  }

  removeRule(restaurantId: string, ruleId: string) {
    return this.removeRules(restaurantId, [ruleId]);
  }

  resetDate(restaurantId: string, date: string) {
    const current = this.ensure(restaurantId);
    if (date < indiaToday()) throw new BadRequestException('Changes can only affect today or future dates.');
    weekdayOf(date);
    const dateOverrides = { ...current.date_overrides };
    delete dateOverrides[date];
    const rules = current.rules.filter((rule) => rule.start_date !== date);
    const candidate = { ...current, rules, date_overrides: dateOverrides, updated_at: new Date().toISOString() };
    this.assertNoConflicts(restaurantId, candidate);
    this.schedules.update(restaurantId, candidate);
    this.materialize(restaurantId);
    return this.get(restaurantId);
  }

  removeRules(restaurantId: string, ruleIds: string[]) {
    const current = this.ensure(restaurantId);
    const ids = new Set(ruleIds);
    if (!ids.size || ruleIds.some((ruleId) => !current.rules.some((rule) => rule.id === ruleId))) throw new NotFoundException('Schedule rule not found');
    const rules = current.rules.filter((rule) => !ids.has(rule.id));
    const dateOverrides = { ...current.date_overrides };
    for (const removed of current.rules.filter((rule) => ids.has(rule.id))) {
      if (removed.start_date && !rules.some((rule) => rule.start_date === removed.start_date)) delete dateOverrides[removed.start_date];
    }
    const candidate = { ...current, rules, date_overrides: dateOverrides, managed: true, updated_at: new Date().toISOString() };
    this.assertNoConflicts(restaurantId, candidate);
    this.schedules.update(restaurantId, candidate);
    this.materialize(restaurantId);
    return this.get(restaurantId);
  }

  materialize(restaurantId: string, days = ROLLING_HORIZON_DAYS) {
    const schedule = this.ensure(restaurantId);
    if (!schedule.managed || schedule.configured === false) return;
    const today = indiaToday();
    this.reconcileGeneratedSlots(restaurantId, schedule);
    this.syncGeneratedLayouts(restaurantId, schedule);
    const defaultLayout = schedule.default_table_layout || this.defaultLayout(restaurantId);
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(`${today}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      const dateValue = date.toISOString().slice(0, 10);
      const windows = this.windowsForDate(restaurantId, dateValue, schedule);
      const existing = this.slots.findByRestaurantId(restaurantId).filter((slot) => slot.slot_date === dateValue);
      windows.forEach(({ start, end }) => {
        if (existing.some((slot) => slot.start_time === start && slot.end_time === end)) return;
        const slot = this.slots.create({
          id: generateId('slot'), restaurant_id: restaurantId, slot_date: dateValue, start_time: start, end_time: end,
          table_layout: structuredClone(defaultLayout),
          published: true, revision: 0, schedule_generated: true,
        });
        defaultLayout.forEach((table) => this.allocations.create({ id: generateId('table_slot'), table_id: table.table_id, slot_id: slot.id, status: 'available' }));
      });
    }
  }

  private syncGeneratedLayouts(restaurantId: string, schedule: RestaurantSchedule) {
    const layout = schedule.default_table_layout || [];
    const ids = new Set(layout.map((entry) => entry.table_id));
    const now = Date.now();
    this.slots.findByRestaurantId(restaurantId).forEach((slot) => {
      if (slot.layout_override || slotInstant(slot.slot_date, slot.start_time).valueOf() <= now) return;
      if (this.reservations.findBySlotId(slot.id).some((reservation) => ['reserved', 'checked_in'].includes(reservation.reservation_status))) return;
      if (JSON.stringify(slot.table_layout) === JSON.stringify(layout) && this.allocations.findBySlotId(slot.id).length === layout.length) return;
      const existingAllocations = this.allocations.findBySlotId(slot.id);
      existingAllocations.forEach((allocation) => {
        if (!ids.has(allocation.table_id)) this.allocations.removeByTableAndSlot(allocation.table_id, slot.id);
      });
      const existingIds = new Set(existingAllocations.filter((allocation) => ids.has(allocation.table_id)).map((allocation) => allocation.table_id));
      layout.forEach((entry) => {
        if (!existingIds.has(entry.table_id)) this.allocations.create({ id: generateId('table_slot'), table_id: entry.table_id, slot_id: slot.id, status: 'available' });
      });
      this.slots.update(slot.id, { table_layout: layout.map((entry) => ({ ...entry })), revision: (slot.revision || 0) + 1 });
    });
  }

  private reconcileGeneratedSlots(restaurantId: string, schedule: RestaurantSchedule) {
    const now = Date.now();
    const today = indiaToday();
    const horizonEnd = new Date(`${today}T12:00:00Z`);
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + ROLLING_HORIZON_DAYS);
    const horizonEndValue = horizonEnd.toISOString().slice(0, 10);
    this.slots.findByRestaurantId(restaurantId).forEach((slot) => {
      if (!slot.schedule_generated || slotInstant(slot.slot_date, slot.start_time).valueOf() <= now) return;
      if (this.reservations.findBySlotId(slot.id).some((reservation) => ['reserved', 'checked_in'].includes(reservation.reservation_status))) return;
      if (slot.slot_date >= horizonEndValue) {
        this.allocations.removeBySlotId(slot.id);
        this.slots.remove(slot.id);
        return;
      }
      const windows = this.windowsForDate(restaurantId, slot.slot_date, schedule);
      const stillApplicable = windows.some((window) => window.start === slot.start_time && window.end === slot.end_time);
      if (!stillApplicable) {
        this.allocations.removeBySlotId(slot.id);
        this.slots.remove(slot.id);
      }
    });
  }

  windowsForDate(restaurantId: string, date: string, schedule = this.ensure(restaurantId)) {
    const effective = this.effectiveForDate(restaurantId, date, schedule);
    if (effective.is_closed) return [];
    const open = minutes(effective.open_time), close = minutes(effective.close_time);
    const result: { start: string; end: string }[] = Array.isArray(effective.slots)
      ? effective.slots
        .filter((slot) => this.isSlotAllowed(restaurantId, date, slot.start_time, slot.end_time, schedule))
        .map((slot) => ({ start: slot.start_time, end: slot.end_time }))
      : [];
    if (!Array.isArray(effective.slots)) {
      const span = (close - open + 1440) % 1440 || 1440;
      const step = effective.slot_duration_minutes + effective.buffer_minutes;
      for (let elapsed = 0; elapsed + effective.slot_duration_minutes <= span; elapsed += step) {
        result.push({ start: timeAt(open + elapsed), end: timeAt(open + elapsed + effective.slot_duration_minutes) });
      }
    }
    effective.rules.filter((rule) => rule.type === 'slot' && rule.slot_action === 'add' && rule.start_time && rule.end_time).forEach((rule) => {
      const candidate = { start: rule.start_time!, end: rule.end_time! };
      if (this.isSlotAllowed(restaurantId, date, candidate.start, candidate.end, schedule) && !result.some((item) => item.start === candidate.start && item.end === candidate.end)) result.push(candidate);
    });
    return result.filter((item) => this.isSlotAllowed(restaurantId, date, item.start, item.end, schedule));
  }
}
