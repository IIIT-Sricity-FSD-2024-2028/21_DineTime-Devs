const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const build = path.resolve(__dirname, '../dist');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('src/')) request = path.join(build, request.slice(4));
  return originalResolve.call(this, request, parent, isMain, options);
};
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require(path.join(build, 'app.module.js'));
let app;
(async () => {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const get = (file, name) => app.get(require(path.join(build, file))[name]);
  const restaurants = get('modules/restaurants/restaurants.service.js', 'RestaurantsService');
  const reservations = get('repositories/reservation.repository.js', 'ReservationRepository');
  const reservationService = get('modules/reservations/reservations.service.js', 'ReservationsService');
  const payments = get('repositories/payment.repository.js', 'PaymentRepository');
  const tickets = get('repositories/support-ticket.repository.js', 'SupportTicketRepository');
  const slots = get('repositories/timeslot.repository.js', 'TimeSlotRepository');
  const finance = get('modules/finance/finance.service.js', 'FinanceService');
  const auth = get('modules/auth/auth.service.js', 'AuthService');
  const superAuth = get('modules/super-admin/super-admin.service.js', 'SuperAdminService');
  const subAuth = get('modules/sub-admin/sub-admin.service.js', 'SubAdminService');
  const invalid = (error) => error.getStatus?.() === 401 && error.message === 'Invalid credentials';
  for (const email of ['missing@example.com', 'manager@dinetime.com']) {
    await assert.rejects(auth.login({ email, password: 'wrong' }), invalid);
  }
  await assert.rejects(superAuth.login({ email: 'admin@dinetime.com', password: 'wrong' }), invalid);
  await assert.rejects(superAuth.login({ email: 'missing@example.com', password: 'wrong' }), invalid);
  for (const team of ['support', 'finance', 'verification']) {
    await assert.rejects(subAuth.login({ email: 'finance@dinetime.com', password: 'wrong', team }), invalid);
  }
  console.log('PASS all invalid-login paths return only Invalid credentials');

  const now = new Date().toISOString();
  slots.create({ id: 'admin-test-slot', restaurant_id: 'res-2001', slot_date: '2031-01-02', start_time: '18:00', end_time: '20:00' });
  const reservation = reservations.create({ id: 'admin-test-res', user_id: 'din-1234', restaurant_id: 'res-2001', slot_id: 'admin-test-slot', table_id: 'tbl-2001-01', guest_count: 2, reservation_status: 'reserved', created_at: now });
  const paid = payments.create({ id: 'admin-test-pay', reservation_id: reservation.id, restaurant_id: 'res-2001', amount: 140, deposit_amount: 120, diner_platform_fee: 20, restaurant_platform_fee: 30, payment_status: 'paid', payment_time: now });
  const extra = payments.create({ ...paid, id: 'admin-test-extra', amount: 60, deposit_amount: 60, diner_platform_fee: 0, restaurant_platform_fee: 0 });
  const ticket = tickets.create({ id: 'admin-test-ticket', linked_reservation_id: reservation.id, raised_by_user_id: 'din-1234', raised_by_role: 'diner', decision: 'refund_approved', status: 'escalated_finance_team', created_at: now });
  const refund = finance.findRefund(ticket.id, 'finance_admin');
  assert.equal(refund.total_paid_amount, 200);
  assert.equal(refund.refundable_amount, 180);
  assert.equal(refund.diner_platform_fee_amount, 20);
  assert.equal(finance.listRefunds('finance_admin').find((row) => row.id === ticket.id).total_paid_amount, 200);
  assert.ok(reservationService.findAll().some((row) => row.id === reservation.id && row.slot_date === '2031-01-02' && row.start_time === '18:00'));
  console.log('PASS finance includes full diner fees and additional payments; global reservations include service date/time');

  const before = restaurants.revenue('res-2001', 'rm-1234');
  assert.equal(before.pending_payout, 150);
  assert.equal(before.paid_by_platform, 0);
  assert.deepEqual(before.payments, []);
  payments.update(paid.id, { settled_at: now, settled_by: 'finance' });
  let revenue = restaurants.revenue('res-2001', 'rm-1234');
  assert.equal(revenue.pending_payout, 60);
  assert.equal(revenue.paid_by_platform, 90);
  assert.equal(revenue.payments.length, 1);
  assert.equal(revenue.payments[0].id, paid.id);
  assert.equal(revenue.payments[0].settled_at, now);
  assert.equal(revenue.payments[0].reservation_id, reservation.id);
  assert.equal(revenue.payments[0].amount, 90);
  payments.update(paid.id, { payment_status: 'refunded', refunded_amount: paid.amount });
  revenue = restaurants.revenue('res-2001');
  assert.equal(revenue.paid_by_platform, 90, 'refunds must not erase an actual previous payout');
  assert.equal(revenue.payments.length, 1);
  payments.update(extra.id, { payout_restaurant_id: 'res-2002', payout_adjustments: [{ id: 'admin-credit', restaurant_id: 'res-2001', amount: 12.25, created_at: now, settled_at: now, settled_by: 'finance' }] });
  revenue = restaurants.revenue('res-2001');
  assert.equal(revenue.pending_payout, 0);
  assert.equal(revenue.paid_by_platform, 102.25);
  assert.equal(revenue.payments.find((row) => row.id === 'admin-credit').payment_id, extra.id);
  assert.equal(revenue.settlement_history[0].amount, 102.25);
  console.log('PASS manager history excludes pending payments, retains real payouts and attributes settled adjustments correctly');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) await app.close(); });
