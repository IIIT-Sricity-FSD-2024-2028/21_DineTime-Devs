const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const backend = path.resolve(process.env.MODIFICATION_TEST_PACKAGE || path.join(__dirname, '..'));
const build = path.resolve(process.env.MODIFICATION_TEST_BUILD || path.join(backend, 'dist'));
const requireBackend = Module.createRequire(path.join(backend, 'package.json'));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('src/')) request = path.join(build, request.slice(4));
  return originalResolve.call(this, request, parent, isMain, options);
};
// Repositories seed into a fresh runtime; never open the developer's live data.
process.chdir(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dinetime-modification-policy-')));
process.env.DINETIME_DB_PATH=path.join(process.cwd(),'data/dinetime.sqlite');
const { NestFactory } = requireBackend('@nestjs/core');
const { AppModule } = requireBackend(path.join(build, 'app.module.js'));
const { validateSync } = requireBackend('class-validator');
const { ModifyReservationDto } = requireBackend(path.join(build, 'modules/reservations/dto/reservations.dto.js'));
let app, checks = 0;
const passed = (name) => { console.log('PASS ' + name); checks++; };
const status = (fn, expected) => assert.throws(fn, (e) => e.getStatus?.() === expected);
(async () => {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
  const get = (file, name) => app.get(requireBackend(path.join(build, file))[name]);
  const reservations = get('modules/reservations/reservations.service.js', 'ReservationsService');
  const payments = get('modules/payments/payments.service.js', 'PaymentsService');
  const paymentRepo = get('repositories/payment.repository.js', 'PaymentRepository');
  const restaurantRepo = get('repositories/restaurant.repository.js', 'RestaurantRepository');
  const tableRepo = get('repositories/table.repository.js', 'TableRepository');
  const slotRepo = get('repositories/timeslot.repository.js', 'TimeSlotRepository');
  const allocations = get('repositories/tableslot.repository.js', 'TableSlotRepository');
  const finance = get('modules/finance/finance.service.js', 'FinanceService');
  const restaurants = get('modules/restaurants/restaurants.service.js', 'RestaurantsService');
  const checkins = get('modules/checkin/checkin.service.js', 'CheckinService');
  const orders = get('modules/orders/orders.controller.js', 'OrdersController');
  const menu = get('repositories/menu.repository.js', 'MenuRepository');
  const support = get('modules/support/support.service.js', 'SupportService');
  const reviews = get('modules/reviews/reviews.service.js', 'ReviewsService');
  const auth = get('modules/auth/auth.service.js', 'AuthService');
  for (const [email, password, role] of [['johndoe@gmail.com', 'password123', 'diner'], ['staff@dinetime.com', 'password123', 'staff'],
    ['manager@dinetime.com', 'password123', 'manager'], ['admin@dinetime.com', 'admin123', 'super_user'],
    ['support@dinetime.com', 'admin123', 'support_admin'], ['finance@dinetime.com', 'admin123', 'finance_admin'],
    ['verification@dinetime.com', 'admin123', 'verification_admin']]) {
    assert.equal((await auth.login({ email, password })).user.role, role);
  }
  passed('authentication works for all actor portals and admin teams');
  const source = restaurantRepo.findAll().find((r) => r.manager_id === 'rm-1234');
  const target = restaurantRepo.findAll().find((r) => r.manager_id === 'rm-1235');
  const sourceTables = tableRepo.findByRestaurantId(source.id), targetTables = tableRepo.findByRestaurantId(target.id);
  const future = (s) => new Date(s.slot_date + 'T' + s.start_time).getTime() > Date.now() + 86400000;
  const slot = slotRepo.findByRestaurantId(source.id).find(future);
  const targetSlot = slotRepo.findByRestaurantId(target.id).find((s) => future(s) && s.slot_date !== slot.slot_date);
  const next = slotRepo.findByRestaurantId(source.id).find((s) => future(s) && s.id !== slot.id);
  assert.ok(targetSlot && next);
  const make = (table, selectedSlot = slot) => reservations.create({ user_id: 'din-1234', restaurant_id: source.id,
    slot_id: selectedSlot.id, table_id: table.id, guest_count: 2 });
  const pay = (booking) => payments.create({ reservation_id: booking.id, payment_method: 'upi', transaction_ref: 'POLICY-' + booking.id, payment_status: 'paid' });
  const booking = make(sourceTables[0]); const receipt = paymentRepo.findById(pay(booking).id);
  const total = receipt.amount;
  assert.equal(reservations.findOne(booking.id).modifications_remaining, 2);
  assert.equal(reservations.findAll('din-1234')[0].payment_summary.amount, total);
  assert.equal(pay(booking).id, receipt.id);
  passed('normal booking, single payment, visible paid amount and initial two-change allowance');
  const initial = { restaurant_id: source.id, slot_id: slot.id, table_ids: [sourceTables[0].id], guest_count: 2 };
  const modify = (values, owner = 'din-1234') => reservations.modify(booking.id, values, owner);
  assert.equal(modify(initial).modification_count, 0);
  status(() => modify(initial, 'another-diner'), 403);
  status(() => modify({ ...initial, guest_count: 999 }), 400);
  status(() => modify({ ...initial, table_ids: [targetTables[0].id] }), 400);
  assert.ok(validateSync(Object.assign(new ModifyReservationDto(), { ...initial, table_ids: [initial.table_ids[0], initial.table_ids[0]] })).length);
  assert.equal(reservations.findOne(booking.id).modification_count, 0);
  passed('unchanged saves and failed owner/capacity/table validation do not consume the limit');
  const conflict = make(sourceTables[2], next);
  status(() => modify({ ...initial, slot_id: next.id, table_ids: [sourceTables[2].id] }), 400);
  assert.equal(allocations.findByTableAndSlot(sourceTables[0].id, slot.id).status, 'reserved');
  assert.equal(reservations.findOne(booking.id).modification_count, 0);
  passed('availability failure preserves the original booking, table and allowance');
  const added = { ...initial, table_ids: sourceTables.slice(0, 2).map((t) => t.id), guest_count: 4 };
  assert.equal(modify(added).modifications_remaining, 1);
  assert.equal(modify(added).modification_count, 1);
  const destination = { restaurant_id: target.id, slot_id: targetSlot.id, table_ids: targetTables.slice(0, 2).map((t) => t.id), guest_count: 3 };
  const changed = modify(destination);
  assert.equal(changed.modification_count, 2);
  assert.equal(changed.modifications_remaining, 0);
  assert.equal(changed.id, booking.id);
  assert.equal(changed.payment_summary.amount, total);
  assert.equal(paymentRepo.findByReservationId(booking.id).length, 1);
  added.table_ids.forEach((id) => assert.equal(allocations.findByTableAndSlot(id, slot.id).status, 'available'));
  passed('table/party change and restaurant/date change use exactly two modifications without charging');
  const snapshot = JSON.stringify(reservations.findOne(booking.id));
  status(() => modify({ ...destination, guest_count: 2 }), 400);
  status(() => modify(initial), 400);
  assert.equal(JSON.stringify(reservations.findOne(booking.id)), snapshot);
  assert.equal(modify(destination).modification_count, 2);
  passed('third change is rejected atomically; duplicate final confirmation remains idempotent');
  const targetPayout = finance.listPayouts('finance_admin').find((p) => p.restaurant_id === target.id);
  assert.equal(receipt.restaurant_id, source.id);
  assert.equal(receipt.payout_restaurant_id, target.id);
  assert.equal(restaurants.revenue(target.id, target.manager_id).pending_payout, targetPayout.pending_payout);
  assert.equal(restaurants.revenue(source.id, source.manager_id).pending_payout, 0);
  assert.ok(reservations.findAll(undefined, target.id).some((r) => r.id === booking.id));
  passed('unsettled credit follows the booking; finance and manager revenue agree; original receipt is preserved');
  const issue = { raised_by_user_id: 'din-1234', raised_by_role: 'diner', category: 'other', subject: 'Unable to check in',
    description: 'Unable to check in', issue_code: 'checkin_problem', reservation_id: booking.id };
  assert.equal(support.create(issue, [], 'din-1234').linked_restaurant_id, target.id);
  status(() => support.create({ ...issue, issue_code: 'other' }, [], 'din-1234'), 400);
  support.create({ ...issue, issue_code: 'other', issue_note: 'Short note' }, [], 'din-1234');
  passed('guided support still links the modified reservation and requires typing only for Other');
  const dishes = menu.findByRestaurantId(target.id);
  assert.ok(dishes.some((dish) => dish.availability && dish.price > 0));
  status(() => orders.create({ reservation_id: booking.id, items: [{ item_id: dishes[0].id, quantity: 1 }] }, { user: { sub: 'din-1234' } }), 410);
  checkins.create({ reservation_id: booking.id, staff_id: 'rst-1234' });
  destination.table_ids.forEach((id) => assert.equal(allocations.findByTableAndSlot(id, targetSlot.id).status, 'occupied'));
  status(() => orders.create({ reservation_id: booking.id, items: [] }, { user: { sub: 'din-1234' } }), 410);
  status(() => modify(destination), 400);
  reservations.update(booking.id, { reservation_status: 'completed' }, 'manager');
  reviews.create({ reservation_id: booking.id, user_id: 'din-1234', restaurant_id: target.id, rating: 5, comment: 'Policy check' });
  destination.table_ids.forEach((id) => assert.equal(allocations.findByTableAndSlot(id, targetSlot.id).status, 'available'));
  passed('menus remain viewable, ordering stays disabled after check-in, completion and reviews still work');
  const cancel = make(sourceTables[0]), cancelReceipt = pay(cancel);
  reservations.modify(cancel.id, { ...added, guest_count: 3 }, 'din-1234');
  const cancelled = reservations.update(cancel.id, { reservation_status: 'cancelled' }, 'diner');
  assert.equal(cancelled.payment_summary.refunded_amount, cancelReceipt.deposit_amount);
  added.table_ids.forEach((id) => assert.equal(allocations.findByTableAndSlot(id, slot.id).status, 'available'));
  reservations.update(conflict.id, { reservation_status: 'cancelled' }, 'diner');
  passed('cancellation still releases all modified tables and refunds the original deposit');
  const settledBooking = make(sourceTables[0]); const settledReceipt = paymentRepo.findById(pay(settledBooking).id);
  finance.settleAll({}, 'finance_admin');
  assert.equal(settledReceipt.settled_at,undefined,'upcoming payments stay held');
  // Simulate an immutable imported settlement from before Phase 2.
  settledReceipt.settled_at=new Date().toISOString();settledReceipt.settled_by='finance';
  const settledAt = settledReceipt.settled_at;
  const originalPaid = restaurants.revenue(source.id, source.manager_id).paid_by_platform;
  reservations.modify(settledBooking.id, destination, 'din-1234');
  assert.equal(settledReceipt.settled_at, settledAt);
  assert.equal(settledReceipt.restaurant_id, source.id);
  assert.equal(settledReceipt.payout_adjustments.length, 2);
  assert.equal(settledReceipt.payout_adjustments.reduce((sum, a) => sum + a.amount, 0), 0);
  for (const restaurant of [source, target]) {
    const payout = finance.listPayouts('finance_admin').find((p) => p.restaurant_id === restaurant.id);
    assert.equal(restaurants.revenue(restaurant.id, restaurant.manager_id).pending_payout, payout.pending_payout);
    assert.equal(restaurants.revenue(restaurant.id, restaurant.manager_id).paid_by_platform, payout.settled_payout);
  }
  assert.equal(restaurants.revenue(source.id, source.manager_id).paid_by_platform, originalPaid);
  assert.equal(finance.listPendingPayments('finance_admin').filter((p) => p.payment_id === settledReceipt.id).length, 2);
  finance.settleAll({}, 'finance_admin');
  assert.ok(settledReceipt.payout_adjustments.every((a) => !a.settled_at),'new credit adjustments stay held until completion');
  assert.equal(settledReceipt.settled_at, settledAt);
  passed('completed payouts remain intact; balanced transfer adjustments settle and reconcile across manager/finance reports');
  reservations.modify(settledBooking.id, initial, 'din-1234');
  assert.equal(settledReceipt.payout_adjustments.length, 4);
  finance.settleAll({}, 'finance_admin');
  assert.equal(restaurants.revenue(source.id, source.manager_id).paid_by_platform, originalPaid);
  checkins.create({reservation_id:settledBooking.id,staff_id:'rst-1234'});
  reservations.update(settledBooking.id,{reservation_status:'completed'},'manager');
  assert.ok(settledReceipt.payout_adjustments.every(a=>a.settled_at));
  assert.equal(paymentRepo.findByReservationId(settledBooking.id).length, 1);
  passed('second restaurant transfer reverses the credit correctly without changing receipts or duplicating payment');
  const {database}=requireBackend(path.join(build,'common/storage/database.js'));
  const notificationService=get('modules/notifications/notifications.service.js','NotificationsService');
  const faultBooking=make(sourceTables[4],next);
  const beforeFailure=JSON.stringify(database.snapshot());
  const originalCreate=notificationService.create;
  notificationService.create=()=>{throw new Error('Injected downstream notification failure');};
  try {
    await assert.rejects(database.transaction(()=>pay(faultBooking)),/Injected downstream notification failure/);
    assert.equal(JSON.stringify(database.snapshot()),beforeFailure);
  } finally {notificationService.create=originalCreate;}
  await database.transaction(()=>pay(faultBooking));
  assert.equal(paymentRepo.findByReservationId(faultBooking.id).length,1);
  passed('a downstream failure rolls payment and every collection back atomically; retry creates one valid receipt');
  console.log(checks + ' modification policy integration checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) await app.close(); });


