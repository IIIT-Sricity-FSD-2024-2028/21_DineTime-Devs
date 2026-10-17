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
  const finance = get('modules/finance/finance.service.js', 'FinanceService');
  const support = get('modules/support/support.service.js', 'SupportService');
  const payments = get('repositories/payment.repository.js', 'PaymentRepository');
  const reservations = get('repositories/reservation.repository.js', 'ReservationRepository');
  const tickets = get('repositories/support-ticket.repository.js', 'SupportTicketRepository');
  const notifications = get('repositories/notification.repository.js', 'NotificationRepository');
  const summary = () => finance.revenueSummary('finance_admin');
  const approve = (id) => finance.decideRefund(id, { approve: true, admin_id: 'fin-0001', notes: 'Verified restaurant service failure.' }, 'finance_admin');
  const fails = (fn, status = 400) => assert.throws(fn, (error) => error.getStatus?.() === status);
  let sequence = 0;
  function fixture(amounts = [200], { settled = false, priorRefund = 0, decision = 'refund_approved' } = {}) {
    const n = ++sequence;
    const reservation = reservations.create({ id: `refund-test-res-${n}`, restaurant_id: 'res-2001', slot_id: 'refund-test-slot', table_id: 'tbl-2001-01', user_id: 'din-1234', guest_count: 2, reservation_status: 'completed', created_at: new Date().toISOString() });
    const rows = amounts.map((amount, index) => payments.create({
      id: `refund-test-pay-${n}-${index}`, reservation_id: reservation.id, restaurant_id: 'res-2001', amount,
      deposit_amount: Math.round(amount * 0.9 * 100) / 100, diner_platform_fee: Math.round(amount * 0.1 * 100) / 100,
      restaurant_platform_fee: 5, payment_status: index === 0 && priorRefund ? 'refunded' : 'paid',
      refunded_amount: index === 0 ? priorRefund : 0, payment_time: new Date().toISOString(),
      payment_method: 'upi', transaction_ref: `demo-${n}-${index}`, ...(settled ? { settled_at: new Date().toISOString(), settled_by: 'finance' } : {}),
    }));
    const ticket = support.create({ raised_by_user_id: 'din-1234', raised_by_role: 'diner', reservation_id: reservation.id, issue_code: 'payment_problem', issue_note: 'Restaurant did not provide the booked service.', category: 'refund', subject: 'Refund required', description: 'Service failure' }, [], 'din-1234');
    support.decision(ticket.id, { decision, notes: 'Verified and sent to finance.', admin_id: 'spt-0001' }, 'support_admin');
    return { reservation, rows, ticket };
  }
  const first = fixture();
  const pending = finance.findRefund(first.ticket.id, 'finance_admin');
  assert.equal(pending.refund_eligible_amount, 180);
  assert.equal(pending.already_refunded_amount, 0);
  assert.equal(pending.refundable_amount, 180);
  const before = summary();
  const result = approve(first.ticket.id);
  assert.equal(result.refund.amount, 180, 'refund is total paid minus the diner platform fee');
  assert.equal(result.refund.reservation_id, first.reservation.id);
  assert.equal(result.refund.processed_by, 'fin-0001');
  assert.equal(result.refund.mode, 'demo');
  assert.equal(first.rows[0].payment_status, 'refunded');
  assert.equal(first.rows[0].release_status, 'refunded');
  assert.equal(first.rows[0].refunded_amount, 180);
  assert.equal(result.refundable_amount, 0);
  assert.equal(result.refund_eligible_amount, 180, 'eligible refund must stay visible after payment is refunded');
  assert.equal(result.already_refunded_amount, 180);
  assert.equal(Math.round((before.finance_balance - summary().finance_balance) * 100), 18000);
  assert.equal(summary().diner_platform_fees, before.diner_platform_fees, 'the platform fee is retained');
  assert.equal(summary().total_paid_by_diners, before.total_paid_by_diners, 'gross payment history is retained');
  assert.equal(Math.round((summary().total_refunded - before.total_refunded) * 100), 18000);
  const dinerReceipt = support.findMine('din-1234').find((ticket) => ticket.id === first.ticket.id).refund;
  const financeReceipt = finance.findRefund(first.ticket.id, 'finance_admin').refund;
  assert.deepEqual(dinerReceipt, financeReceipt);
  assert.equal(support.findMine('din-1234').find((ticket) => ticket.id === first.ticket.id).reservation_refunded_amount, 180);
  const audit = finance.refundAudit('finance_admin').find((payment) => payment.payment_id === first.rows[0].id);
  assert.equal(audit.refund_transactions[0].refund_id, dinerReceipt.id);
  assert.equal(audit.refund_transactions[0].ticket_id, first.ticket.id);
  const balance = summary().finance_balance;
  const noticeCount = notifications.findAll().length;
  assert.equal(approve(first.ticket.id).refund.id, dinerReceipt.id);
  assert.equal(first.rows[0].refund_transactions.length, 1);
  assert.equal(summary().finance_balance, balance);
  assert.equal(notifications.findAll().length, noticeCount);
  console.log('PASS full refund, shared diner/finance receipt, balance deduction, audit and idempotency');

  const split = fixture([120.25, 30.10], { priorRefund: 20.25, decision: 'finance_review' });
  const splitBefore = summary().finance_balance;
  const splitResult = approve(split.ticket.id);
  assert.equal(splitResult.refund.amount, 115.06);
  assert.equal(splitResult.refund.payments.length, 2);
  assert.equal(Math.round((splitBefore - summary().finance_balance) * 100), 11506);
  assert.equal(split.rows[0].refunded_amount, 108.22);
  assert.equal(split.rows[1].refunded_amount, 27.09);
  console.log('PASS diner finance-review escalation, additional payments and prior partial refunds');

  const released = fixture([100], { settled: true });
  const releasedBefore = summary();
  approve(released.ticket.id);
  assert.equal(summary().total_payouts_settled, releasedBefore.total_payouts_settled, 'a refund cannot erase money already paid to a restaurant');
  assert.equal(Math.round((releasedBefore.finance_balance - summary().finance_balance) * 100), 9000);
  assert.equal(released.rows[0].settled_by, 'finance');
  assert.ok(released.rows[0].settled_at);
  console.log('PASS post-payout refunds debit the platform while retaining settled payout history');

  const denied = fixture();
  const deniedBefore = summary().finance_balance;
  finance.decideRefund(denied.ticket.id, { approve: false, admin_id: 'fin-0001', notes: 'Service was supplied.' }, 'finance_admin');
  assert.equal(denied.rows[0].payment_status, 'paid');
  assert.equal(denied.ticket.refund, undefined);
  assert.equal(summary().finance_balance, deniedBefore);
  const unpaid = fixture([]);
  fails(() => approve(unpaid.ticket.id));
  assert.equal(unpaid.ticket.status, 'escalated_finance_team');
  const foreign = fixture();
  tickets.update(foreign.ticket.id, { linked_payment_id: denied.rows[0].id });
  fails(() => approve(foreign.ticket.id));
  assert.equal(foreign.rows[0].payment_status, 'paid');
  fails(() => finance.decideRefund(foreign.ticket.id, { approve: true, admin_id: 'spt-0001', notes: 'Not finance.' }, 'support_admin'), 403);
  const duplicate = tickets.create({ ...first.ticket, id: 'refund-test-duplicate', status: 'escalated_finance_team', refund: undefined });
  const duplicateDisplay = finance.findRefund(duplicate.id, 'finance_admin');
  assert.equal(duplicateDisplay.refund_eligible_amount, 180);
  assert.equal(duplicateDisplay.already_refunded_amount, 180);
  assert.equal(duplicateDisplay.refundable_amount, 0);
  fails(() => approve(duplicate.id));
  tickets.update(duplicate.id, { status: 'resolved' });
  const legacyTicket = support.findMine('din-1234').find((ticket) => ticket.id === duplicate.id);
  assert.equal(legacyTicket.reservation_refunded_amount, 180);
  assert.equal(legacyTicket.refund, undefined, 'payment-backed legacy amount must not invent a ticket refund receipt');
  const splitDiner = support.findMine('din-1234').find((ticket) => ticket.id === split.ticket.id);
  assert.equal(splitDiner.reservation_refunded_amount, 135.31, 'the ticket response totals all actual reservation refunds');
  console.log('PASS denied, unpaid, mismatched and duplicate refunds cannot deduct funds or claim success');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (app) await app.close(); });
