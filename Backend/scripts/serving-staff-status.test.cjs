const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const backend = path.resolve(__dirname, '..');
const build = path.join(backend, 'dist');
const requireBackend = Module.createRequire(path.join(backend, 'package.json'));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('src/')) request = path.join(build, request.slice(4));
  return originalResolve.call(this, request, parent, isMain, options);
};
// Own the runtime: never change the developer's running API or booking data.
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'dinetime-serving-status-tests-')));
const { NestFactory } = requireBackend('@nestjs/core');
const { AppModule } = requireBackend(path.join(build, 'app.module.js'));
const fails = (action, status, text) => assert.throws(action, error => error.getStatus?.() === status && (!text || text.test(error.message)));
let app;
(async () => {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
  const get = (file, name) => app.get(requireBackend(path.join(build, file))[name]);
  const restaurants = get('modules/restaurants/restaurants.service.js', 'RestaurantsService');
  const bookings = get('modules/reservations/reservations.service.js', 'ReservationsService');
  const payments = get('modules/payments/payments.service.js', 'PaymentsService');
  const checkins = get('modules/checkin/checkin.service.js', 'CheckinService');
  const statuses = get('modules/tableslots/tableslots.service.js', 'TableslotsService');
  const tableRepo = get('repositories/table.repository.js', 'TableRepository');
  const slotRepo = get('repositories/timeslot.repository.js', 'TimeSlotRepository');
  const allocationRepo = get('repositories/tableslot.repository.js', 'TableSlotRepository');
  const bookingRepo = get('repositories/reservation.repository.js', 'ReservationRepository');
  const notificationRepo = get('repositories/notification.repository.js', 'NotificationRepository');
  const { AccessPolicyGuard } = requireBackend(path.join(build, 'common/guards/access-policy.guard.js'));
  const guard = new AccessPolicyGuard(...Reflect.getMetadata('design:paramtypes', AccessPolicyGuard).map(type => app.get(type)));
  const schedules = get('modules/schedules/schedules.service.js', 'SchedulesService');
  const restaurant = restaurants.findAll().find(row => row.manager_id === 'rm-1234');
  const id = restaurant.id;
  const tables = tableRepo.findByRestaurantId(id);
  const slots = slotRepo.findByRestaurantId(id).filter(slot => new Date(slot.slot_date + 'T' + slot.start_time).getTime() > Date.now() + 86400000);
  const slot = slots[0], otherSlot = slots[1];
  assert.ok(slot && otherSlot && tables.length >= 3);
  const create = (tableId = tables[0].id, slotId = slot.id) => bookings.create({ user_id: 'din-1234', restaurant_id: id, table_id: tableId, slot_id: slotId, guest_count: 2 });
  const booking = create();
  const paid = payments.create({ reservation_id: booking.id, payment_method: 'upi', transaction_ref: 'OPERATIONS-TEST', payment_status: 'paid' });
  const before = JSON.stringify(payments.findOne(paid.id));
  const notificationCount = notificationRepo.findAll().length;
  const paused = restaurants.setServingStatus(id, 'rm-1234', false);
  assert.equal(paused.active_reservation_count, 1);
  assert.equal(bookings.findOne(booking.id).reservation_status, 'reserved');
  assert.equal(bookings.findOne(booking.id).restaurant_summary.name, restaurant.name);
  assert.equal(bookings.findOne(booking.id).restaurant_summary.is_open, false);
  assert.equal(JSON.stringify(payments.findOne(paid.id)), before);
  assert.equal(notificationRepo.findAll().length, notificationCount);
  assert.ok(!restaurants.findAll(undefined, 'diner').some(row => row.id === id));
  fails(() => create(tables[1].id), 400, /not available/);
  fails(() => restaurants.setClosureStatus(id, 'rm-1234', true), 409, /active reservation/);
  fails(() => restaurants.setClosureStatus(id, 'rm-1235', true), 400, /do not manage/);
  assert.equal(restaurant.is_closed, undefined);
  const scopedRequest = user => ({ path: '/tableslots/availability', method: 'GET', query: { restaurant_id: id }, body: {}, user: { sub: user, role: 'diner' } });
  const ownerRequest = scopedRequest('din-1234');
  assert.equal(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ownerRequest }) }), true);
  assert.ok(ownerRequest.allowedRestaurantIds.includes(id));
  const strangerRequest = scopedRequest('another-diner');
  fails(() => guard.canActivate({ switchToHttp: () => ({ getRequest: () => strangerRequest }) }), 403);
  const changed = bookings.modify(booking.id, { restaurant_id: id, slot_id: otherSlot.id, table_ids: [tables[1].id], guest_count: 2 }, 'din-1234');
  assert.equal(changed.slot_id, otherSlot.id);
  assert.equal(changed.reservation_status, 'reserved');
  checkins.create({ reservation_id: booking.id, staff_id: 'rst-1234' });
  fails(() => restaurants.setClosureStatus(id, 'rm-1234', true), 409);
  console.log('PASS pause preserves payment/details and check-in, blocks new booking, allows owner rescheduling, and closure rejects active bookings.');
  restaurants.setServingStatus(id, 'rm-1234', true);

  const read = (tableId, slotId = slot.id) => statuses.findAll(id, slotId).find(row => row.table_id === tableId);
  const dto = { table_id: tables[2].id, slot_id: slot.id };
  for (const status of ['reserved', 'occupied', 'blocked', 'available', 'occupied', 'reserved', 'available']) {
    statuses.updateStatus({ ...dto, status });
    assert.equal(read(dto.table_id).status, status);
    assert.equal(read(dto.table_id, otherSlot.id).status, 'available');
    if (status !== 'available') {
      assert.equal(read(dto.table_id).manual_status, status);
      fails(() => create(dto.table_id), 400);
    } else {
      assert.equal(read(dto.table_id).manual_status, undefined);
      assert.equal(read(dto.table_id).manual_block, undefined);
    }
  }
  assert.equal(read(dto.table_id).status, 'available');
  statuses.updateStatus({ ...dto, status: 'blocked' });
  assert.equal(read(dto.table_id).status, 'blocked');
  assert.equal(read(dto.table_id).manual_block, true);
  assert.equal(read(dto.table_id, otherSlot.id).status, 'available');
  // New allocations retain every manual status on repeated reads too.
  for (const status of ['reserved', 'occupied', 'blocked']) {
    allocationRepo.removeByTableAndSlot(dto.table_id, slot.id);
    statuses.updateStatus({ ...dto, status });
    assert.equal(read(dto.table_id).status, status);
    assert.equal(read(dto.table_id).manual_status, status);
    assert.equal(read(dto.table_id).status, status);
  }
  fails(() => create(dto.table_id), 400);
  statuses.updateStatus({ ...dto, status: 'available' });
  assert.equal(read(dto.table_id).status, 'available');
  const occupied = { table_id: tables[1].id, slot_id: otherSlot.id };
  for (const status of ['available', 'blocked', 'reserved']) fails(() => statuses.updateStatus({ ...occupied, status }), 400, /checked-in diner/);
  assert.equal(statuses.updateStatus({ ...occupied, status: 'occupied' }).status, 'occupied');
  const originalIsBlocked = schedules.isTableBlocked.bind(schedules);
  schedules.isTableBlocked = (...args) => args[4] === dto.table_id || originalIsBlocked(...args);
  assert.equal(read(dto.table_id).schedule_block, true);
  for (const status of ['available', 'reserved', 'occupied', 'blocked']) fails(() => statuses.updateStatus({ ...dto, status }), 400, /manager schedule/);
  schedules.isTableBlocked = originalIsBlocked;
  console.log('PASS all four manual statuses persist for one service, prevent double booking, and protect booked tables and manager blocks.');

  bookingRepo.update(booking.id, { reservation_status: 'completed' });
  assert.equal(read(occupied.table_id, otherSlot.id).status, 'available');
  assert.equal(restaurants.setClosureStatus(id, 'rm-1234', true).is_closed, true);
  fails(() => restaurants.setServingStatus(id, 'rm-1234', true), 400, /Reopen/);
  const reopened = restaurants.setClosureStatus(id, 'rm-1234', false);
  assert.equal(reopened.is_closed, false);
  assert.equal(reopened.is_open, false);
  restaurants.setServingStatus(id, 'rm-1234', true);
  assert.equal(restaurant.is_open, true);
  const reserved = create(dto.table_id);
  fails(() => statuses.updateStatus({ ...dto, status: 'available' }), 400, /reservation/);
  fails(() => statuses.updateStatus({ ...dto, status: 'occupied' }), 400, /Customer Check-In/);
  bookings.update(reserved.id, { reservation_status: 'cancelled' }, 'diner');
  assert.equal(read(dto.table_id).status, 'available');
  console.log('PASS completion/cancellation release tables; closure succeeds only once bookings resolve; reopening leaves new reservations paused.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) await app.close(); });
