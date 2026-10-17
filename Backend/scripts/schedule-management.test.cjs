const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'dist');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveBackend(request, parent, isMain, options) {
  if (request.startsWith('src/')) request = path.join(build, request.slice(4));
  return originalResolve.call(this, request, parent, isMain, options);
};

process.env.DINETIME_DB_PATH = path.join(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dinetime-schedule-')), 'test.sqlite');
const { NestFactory } = require('@nestjs/core');
const { of, lastValueFrom } = require('rxjs');
const { AppModule } = require(path.join(build, 'app.module.js'));
const { indiaToday, slotInstant } = require(path.join(build, 'common/utils/india-time.util.js'));

let app;
(async () => {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const get = (file, name) => app.get(require(path.join(build, file))[name]);
  const schedules = get('modules/schedules/schedules.service.js', 'SchedulesService');
  const reservations = get('repositories/reservation.repository.js', 'ReservationRepository');
  const restaurants = get('repositories/restaurant.repository.js', 'RestaurantRepository');
  const slots = get('repositories/timeslot.repository.js', 'TimeSlotRepository');
  const tables = get('repositories/table.repository.js', 'TableRepository');
  const timeslots = get('modules/timeslots/timeslots.service.js', 'TimeslotsService');
  const tableslots = get('modules/tableslots/tableslots.service.js', 'TableslotsService');
  const tableService = get('modules/tables/tables.service.js', 'TablesService');
  const managers = get('modules/manager/manager.service.js', 'ManagerService');
  const users = get('repositories/user.repository.js', 'UserRepository');
  const restaurantService = get('modules/restaurants/restaurants.service.js', 'RestaurantsService');
  const instantiateGlobal = (file, name) => {
    const Provider = require(path.join(build, file))[name];
    return new Provider(...Reflect.getMetadata('design:paramtypes', Provider).map((Dependency) => app.get(Dependency)));
  };
  const accessPolicy = instantiateGlobal('common/guards/access-policy.guard.js', 'AccessPolicyGuard');
  const responseFilter = instantiateGlobal('common/storage/memory-state.service.js', 'MemoryStateInterceptor');
  async function dinerRead(path, load, query = {}) {
    const request = { path, method: 'GET', query, user: { role: 'diner', sub: 'din-1234' } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    accessPolicy.canActivate(context);
    return (await lastValueFrom(responseFilter.intercept(context, { handle: () => of({ data: load() }) }))).data;
  }

  const restaurant = restaurants.findAll()[0];
  const restaurantId = restaurant.id;
  const schedule = schedules.get(restaurantId);
  assert.equal(tables.findByRestaurantId('res-2001').length, 6);
  assert.ok(schedule.weekly.every((day) => day.slots.length === 3));
  const futureSlot = slots.findByRestaurantId(restaurantId).find((slot) => slotInstant(slot.slot_date, slot.start_time).valueOf() > Date.now() + 3600000);
  assert.ok(futureSlot, 'seed should include a future slot');
  const defaultLayout = schedule.default_table_layout.map((entry) => ({ ...entry }));
  assert.ok(defaultLayout.length, 'seed should include a weekly table layout');

  const weekly = schedule.weekly.map((day) => ({ ...day }));
  const closedWeekday = weekly.find((day) => day.weekday === ((new Date(`${futureSlot.slot_date}T12:00:00Z`).getUTCDay() + 1) % 7));
  closedWeekday.is_closed = true;
  schedules.updateWeekly(restaurantId, { weekly });
  assert.equal(schedules.effectiveForDate(restaurantId, futureSlot.slot_date).is_closed, false);

  const date = futureSlot.slot_date;
  const closure = schedules.createRule(restaurantId, { restaurant_id: restaurantId, scope: 'date', type: 'closure', start_date: date });
  assert.equal(schedules.effectiveForDate(restaurantId, date).is_closed, true);
  schedules.removeRule(restaurantId, closure.id);
  assert.equal(schedules.effectiveForDate(restaurantId, date).is_closed, false);

  const customLayout = [{ ...defaultLayout[0], capacity: Math.max(1, Number(defaultLayout[0].capacity) - 1) }];
  const saved = timeslots.saveLayout(futureSlot.id, { revision: futureSlot.revision || 0, tables: customLayout });
  assert.equal(saved.layout_override, true);
  const reverted = timeslots.resetLayout(futureSlot.id, saved.revision);
  assert.equal(reverted.layout_override, false);
  assert.deepEqual(slots.findById(futureSlot.id).table_layout, defaultLayout);

  reservations.create({ id: 'schedule-conflict', user_id: 'din-1234', restaurant_id: restaurantId, slot_id: futureSlot.id, table_id: defaultLayout[0].table_id, guest_count: 2, reservation_status: 'reserved', created_at: new Date().toISOString() });
  const latestRevision = slots.findById(futureSlot.id).revision || 0;
  const otherTableChange = [
    { ...defaultLayout[0] },
    { ...defaultLayout[1], capacity: Number(defaultLayout[1].capacity) + 1 },
  ];
  const partiallySaved = timeslots.saveLayout(futureSlot.id, { revision: latestRevision, tables: otherTableChange });
  assert.equal(partiallySaved.layout_override, true);
  assert.equal(slots.findById(futureSlot.id).table_layout.length, 2);
  assert.throws(() => timeslots.saveLayout(futureSlot.id, { revision: partiallySaved.revision, tables: [{ ...defaultLayout[1] }] }), (error) => error.getStatus?.() === 409);
  assert.throws(() => timeslots.saveLayout(futureSlot.id, { revision: partiallySaved.revision, tables: [{ ...defaultLayout[0], capacity: 10 }, otherTableChange[1]] }), (error) => error.getStatus?.() === 409);
  assert.throws(() => tableslots.updateStatus({ table_id: defaultLayout[0].table_id, slot_id: futureSlot.id, status: 'blocked' }), (error) => error.getStatus?.() === 400);
  tableslots.updateStatus({ table_id: defaultLayout[1].table_id, slot_id: futureSlot.id, status: 'blocked' });
  assert.equal(tableslots.findAll(restaurantId, futureSlot.id).find((entry) => entry.table_id === defaultLayout[1].table_id).status, 'blocked');
  assert.throws(() => timeslots.delete(futureSlot.id), (error) => error.getStatus?.() === 409);
  assert.throws(() => schedules.createRule(restaurantId, { restaurant_id: restaurantId, scope: 'date', type: 'slot', start_date: date, start_time: futureSlot.start_time, end_time: futureSlot.end_time, slot_action: 'remove' }), (error) => error.getStatus?.() === 409);
  assert.throws(() => schedules.createRule(restaurantId, { restaurant_id: restaurantId, scope: 'date', type: 'closure', start_date: date }), (error) => error.getStatus?.() === 409);

  const protectedLayout = structuredClone(slots.findById(futureSlot.id).table_layout);
  schedules.updateDefaultLayout(restaurantId, defaultLayout.filter((entry) => entry.table_id !== defaultLayout[0].table_id));
  assert.deepEqual(slots.findById(futureSlot.id).table_layout, protectedLayout, 'weekly removal must preserve the booked date layout');
  assert.throws(() => timeslots.resetLayout(futureSlot.id, slots.findById(futureSlot.id).revision), (error) => error.getStatus?.() === 409);
  schedules.updateDefaultLayout(restaurantId, defaultLayout.map((entry, index) => index === 0 ? { ...entry, capacity: 1 } : entry));
  assert.deepEqual(slots.findById(futureSlot.id).table_layout, protectedLayout, 'weekly capacity changes must preserve reserved seats');
  assert.throws(() => timeslots.resetLayout(futureSlot.id, slots.findById(futureSlot.id).revision), (error) => error.getStatus?.() === 409);
  schedules.updateDefaultLayout(restaurantId, defaultLayout);
  const safeRevert = timeslots.resetLayout(futureSlot.id, slots.findById(futureSlot.id).revision);
  assert.equal(safeRevert.layout_override, false);
  assert.equal(tableslots.findAll(restaurantId, futureSlot.id).find((entry) => entry.table_id === defaultLayout[0].table_id).status, 'reserved');

  const changedWeekly = weekly.map((day) => ({ ...day, is_closed: false, slot_duration_minutes: 60, slots: [{ start_time: '11:00', end_time: '12:00' }] }));
  schedules.updateWeekly(restaurantId, { weekly: changedWeekly });
  assert.ok(schedules.get(restaurantId).date_overrides[date], 'booked dates retain a snapshot when the weekly slots change');
  assert.equal(schedules.isSlotAllowed(restaurantId, date, futureSlot.start_time, futureSlot.end_time), true);
  assert.ok(timeslots.findAll(restaurantId, date, true).some((entry) => entry.id === futureSlot.id));
  assert.ok(timeslots.findOne(futureSlot.id).reservation_count > 0);
  assert.throws(() => schedules.resetDate(restaurantId, date), (error) => error.getStatus?.() === 409);
  assert.ok(schedules.get(restaurantId).date_overrides[date], 'a failed revert must leave the protected date intact');
  schedules.updateWeekly(restaurantId, { weekly });
  schedules.resetDate(restaurantId, date);
  assert.equal(schedules.get(restaurantId).date_overrides?.[date], undefined);

  const { restaurant: newcomer, manager: newcomerManager } = await managers.register({
    name: 'Scheduling Test Manager', email: 'scheduling@example.test', phone: '9000000021', password: 'test-password',
    restaurant_name: 'Scheduling Test Restaurant', cuisine_type: 'Indian', description: 'Schedule integration fixture',
    restaurant_phone: '9000000022', city: 'Agartala', address: 'Test Street', state: 'Tripura', pincode: '799001',
    verification_location_id: 'loc_blr_1', business_license_number: 'SCHEDULE-TEST',
  }, '/uploads/test-license.pdf');
  const initial = schedules.get(newcomer.id);
  assert.equal(initial.configured, false);
  assert.ok(initial.weekly.every((day) => day.slots.length === 0));
  assert.deepEqual(timeslots.findAll(newcomer.id), []);
  timeslots.findAll(); // Global diner discovery must not initialize new-manager slots.
  assert.equal(slots.findByRestaurantId(newcomer.id).length, 0);
  schedules.updateDate(newcomer.id, { start_date: date, is_closed: false, open_time: '11:00', close_time: '23:00', slots: [{ start_time: '18:00', end_time: '20:00' }] });
  const firstDateSlot = timeslots.findAll(newcomer.id, date, true)[0];
  assert.ok(firstDateSlot, 'a date-only first slot must be visible to diners without saving a weekly schedule');
  assert.equal(firstDateSlot.published, true);
  const firstTable = tableService.create({ restaurant_id: newcomer.id, table_number: 1, capacity: 2 });
  schedules.updateDefaultLayout(newcomer.id, [{ table_id: firstTable.id, capacity: 2 }]);
  assert.equal(tableslots.getAvailability(newcomer.id, firstDateSlot.id).find((entry) => entry.table_id === firstTable.id)?.status, 'available', 'adding tables after slots must populate diner availability');
  assert.equal(timeslots.findOne(firstDateSlot.id).table_layout[0].capacity, 2);

  users.update(newcomerManager.id, { status: 'active' });
  users.upsertManagerDetails({ ...users.getManagerDetails(newcomerManager.id), verification_status: 'approved' });
  restaurants.update(newcomer.id, { is_open: true });
  assert.ok(restaurantService.findAll(undefined, 'diner').some((entry) => entry.id === newcomer.id));
  const dinerSlots = await dinerRead('/timeslots', () => timeslots.findAll(undefined, undefined, true));
  assert.ok(dinerSlots.some((entry) => entry.restaurant_id === newcomer.id), 'an approved/open Agartala restaurant must expose slots through the diner guard and response filter');
  const dinerTables = await dinerRead('/tables', () => tableService.findAll());
  assert.ok(dinerTables.some((entry) => entry.restaurant_id === newcomer.id), 'the diner table catalog must use the same city policy as restaurant discovery');
  const dinerSlot = dinerSlots.find((entry) => entry.restaurant_id === newcomer.id && slotInstant(entry.slot_date, entry.start_time) > Date.now());
  assert.ok(dinerSlot);
  const dinerAvailability = await dinerRead('/tableslots/availability', () => tableslots.getAvailability(newcomer.id, dinerSlot.id), { restaurant_id: newcomer.id, slot_id: dinerSlot.id });
  assert.ok(dinerAvailability.some((entry) => entry.table_id === firstTable.id && entry.status === 'available'));
  const delhi = restaurants.findAll().find((entry) => restaurants.findLocationById(entry.location_id)?.city === 'Delhi');
  assert.ok(dinerSlots.some((entry) => entry.restaurant_id === delhi.id), 'seeded restaurants outside Bangalore must also expose their slots');
  restaurants.update(newcomer.id, { is_open: false });
  assert.equal((await dinerRead('/timeslots', () => timeslots.findAll(undefined, undefined, true))).some((entry) => entry.restaurant_id === newcomer.id), false);
  restaurants.update(newcomer.id, { is_open: true });
  users.upsertManagerDetails({ ...users.getManagerDetails(newcomerManager.id), verification_status: 'pending' });
  assert.equal((await dinerRead('/tables', () => tableService.findAll())).some((entry) => entry.restaurant_id === newcomer.id), false);
  schedules.resetDate(newcomer.id, date);
  assert.equal(timeslots.findAll(newcomer.id, date, true).length, 0);
  const hoursOnly = initial.weekly.map((day) => ({ ...day, open_time: '10:00', close_time: '22:00', slots: [] }));
  schedules.updateWeekly(newcomer.id, { weekly: hoursOnly });
  assert.equal(slots.findByRestaurantId(newcomer.id).length, 0);

  const tableFive = tableService.create({ restaurant_id: newcomer.id, table_number: 5, capacity: 4 });
  schedules.updateDefaultLayout(newcomer.id, [{ table_id: firstTable.id, capacity: 2 }, { table_id: tableFive.id, capacity: 4 }]);
  assert.equal(slots.findByRestaurantId(newcomer.id).length, 0);
  schedules.updateDefaultLayout(newcomer.id, [{ table_id: firstTable.id, capacity: 2 }]);
  tableService.delete(tableFive.id);
  const restoredFive = tableService.create({ restaurant_id: newcomer.id, table_number: 5, capacity: 6 });
  assert.equal(restoredFive.id, tableFive.id);
  assert.equal(restoredFive.capacity, 6);

  const explicitSlots = [{ start_time: '12:00', end_time: '14:00' }, { start_time: '18:00', end_time: '20:00' }];
  schedules.updateWeekly(newcomer.id, { weekly: hoursOnly.map((day) => ({ ...day, slots: explicitSlots })) });
  assert.equal(timeslots.findAll(newcomer.id, undefined, true).length, 14);
  assert.ok(timeslots.findAll(newcomer.id, undefined, true).every((slot) => explicitSlots.some((window) => window.start_time === slot.start_time && window.end_time === slot.end_time)));
  const staleSlot = slots.create({ id: 'integration-stale-slot', restaurant_id: newcomer.id, slot_date: date, start_time: '14:00', end_time: '16:00' });
  assert.equal(timeslots.findAll(newcomer.id, date, true).some((slot) => slot.id === staleSlot.id), false);
  assert.deepEqual(tableslots.getAvailability(newcomer.id, staleSlot.id), []);
  schedules.updateDate(newcomer.id, { start_date: date, open_time: '10:00', close_time: '22:00', is_closed: false, slots: [explicitSlots[0]] });
  assert.deepEqual(timeslots.findAll(newcomer.id, date, true).map((slot) => slot.start_time), ['12:00']);
  const exceptions = schedules.get(newcomer.id).rules.filter((rule) => rule.start_date === date);
  schedules.removeRules(newcomer.id, exceptions.map((rule) => rule.id));
  assert.equal(timeslots.findAll(newcomer.id, date, true).length, 2);
  schedules.updateDate(newcomer.id, { start_date: date, open_time: '10:00', close_time: '22:00', is_closed: false, slots: [{ start_time: '13:00', end_time: '15:00' }] });
  assert.deepEqual(timeslots.findAll(newcomer.id, date, true).map((slot) => slot.start_time), ['13:00'], 'replacement slots must not be hidden by removal rules for the old overlapping default');
  schedules.resetDate(newcomer.id, date);

  console.log('PASS weekly/date schedules, diner synchronization, reservation protection, table-number reuse, and empty new-manager onboarding');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) await app.close(); });
