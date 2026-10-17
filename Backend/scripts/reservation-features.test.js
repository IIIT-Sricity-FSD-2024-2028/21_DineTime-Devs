const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join, dirname, basename } = require('node:path');
const { JwtService } = require('node:module').createRequire(resolve(process.env.PHASE_ONE_PACKAGE || resolve(__dirname,'..'),'package.json'))('@nestjs/jwt');
const { setTimeout: wait } = require('node:timers/promises');

// Each run owns a disposable runtime directory. It never loads or overwrites the
// developer's persisted table availability, logs, or uploaded files.
const runtime = mkdtempSync(join(tmpdir(), 'dinetime-reservation-tests-'));
const port = Number(process.env.FEATURE_TEST_PORT || 4500 + Math.floor(Math.random() * 1000));
const base = `http://127.0.0.1:${port}`;
const testSecret = 'isolated-reservation-feature-tests';
const server = spawn(process.execPath, process.env.PHASE_ONE_BOOTSTRAP ? ['-r',process.env.PHASE_ONE_BOOTSTRAP,resolve(process.env.PHASE_ONE_BUILD,'main.js')] : [resolve(__dirname, '../start.js')], {
  cwd: runtime, env: { ...process.env, PORT: String(port), DINETIME_DB_PATH:join(runtime,'data/dinetime.sqlite'), JWT_SECRET: testSecret }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
let checks = 0;
const actorTokens={};
function passed(message) { checks++; console.log(`PASS ${message}`); }
async function request(path, roleOrToken = 'diner', method = 'GET', body, status = 200) {
  if(typeof roleOrToken==='string') {
    if(!actorTokens[roleOrToken]) {
      const emails={diner:'johndoe@gmail.com',manager:'manager@dinetime.com',staff:'staff@dinetime.com',finance_admin:'finance@dinetime.com'};
      const authResponse=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emails[roleOrToken],password:roleOrToken.endsWith('_admin') ? 'admin123':'password123'})});
      actorTokens[roleOrToken]=await authResponse.json();
    }
    roleOrToken=actorTokens[roleOrToken];
  }
  const headers = roleOrToken && typeof roleOrToken === 'object' 
    ? { Authorization: `Bearer ${roleOrToken.access_token}` } : { role: roleOrToken };
  const multipart = body instanceof FormData;
  if (!multipart) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method, headers,
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data.data ?? data;
}
async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base + '/api-docs')).ok) { ready = true; break; } } catch {}
    await wait(250);
  }
  assert.ok(ready, output);
  const diner = await request('/auth/login', 'diner', 'POST', { email: 'johndoe@gmail.com', password: 'password123' }, 201);
  const manager = await request('/auth/login', 'manager', 'POST', { email: 'manager@dinetime.com', password: 'password123' }, 201);
  const otherManager = await request('/auth/login', 'manager', 'POST', { email: 'manager2@dinetime.com', password: 'password123' }, 201);
  const restaurants = await request('/restaurants');
  const source = restaurants.find((item) => item.manager_id === manager.user.id);
  const target = restaurants.find((item) => item.manager_id === otherManager.user.id);
  assert.ok(source && target);
  const tables = await request(`/tables?restaurant_id=${source.id}`);
  const targetTables = await request(`/tables?restaurant_id=${target.id}`);
  const slots = await request(`/timeslots?restaurant_id=${source.id}`);
  const targetSlots = await request(`/timeslots?restaurant_id=${target.id}`);
  const future = (item) => new Date(`${item.slot_date}T${item.start_time}`).getTime() > Date.now() + 86400000;
  const slot = slots.find(future);
  const nextSlot = slots.find((item) => future(item) && item.slot_date !== slot.slot_date && item.start_time !== slot.start_time);
  const targetSlot = targetSlots.find(future);
  assert.ok(slot && nextSlot && targetSlot && tables.length >= 3 && targetTables.length >= 2);
  const booking = await request('/reservations', diner, 'POST', {
    user_id: diner.user.id, restaurant_id: source.id, table_id: tables[0].id, slot_id: slot.id, guest_count: 2,
  }, 201);
  const payment = await request('/payments', diner, 'POST', {
    reservation_id: booking.id, payment_method: 'upi', transaction_ref: 'FEATURE-TEST', payment_status: 'paid',
  }, 201);
  const original = await request(`/reservations/${booking.id}`, diner);
  assert.equal(original.payment_summary.amount, payment.amount);
  assert.equal((await request(`/reservations?user_id=${diner.user.id}`, diner))[0].payment_summary.id, payment.id);
  passed('paid amount and receipt are returned on reservation list and details');

  const modification = { restaurant_id: source.id, slot_id: slot.id,
    table_ids: [tables[0].id, tables[1].id], guest_count: tables[0].capacity + tables[1].capacity };
  const modify = (values, status = 200, auth = diner) => request(`/reservations/${booking.id}/modify`, auth, 'PATCH', values, status);
  const added = await modify(modification);
  assert.equal(added.id, booking.id);
  assert.deepEqual(added.table_ids, modification.table_ids);
  assert.equal(added.payment_summary.amount, payment.amount);
  assert.equal((await request(`/payments?reservation_id=${booking.id}`, diner)).length, 1);
  passed('multiple tables and more guests retain reservation ID and original payment with no extra charge');
  const repeat = await modify(modification);
  assert.equal(repeat.modification_history.length, 1);
  passed('duplicate Save Changes is idempotent');
  await modify(modification, 401, null);
  const foreignDiner = { access_token: new JwtService({ secret: testSecret }).sign({ sub: 'another-diner', role: 'diner' }) };
  await modify(modification, 401, foreignDiner);
  passed('modification requires the authenticated reservation owner');
  await modify({ ...modification, table_ids: [tables[0].id, tables[0].id] }, 400);
  await modify({ ...modification, guest_count: 999 }, 400);
  await modify({ ...modification, table_ids: [targetTables[0].id] }, 400);
  passed('duplicate tables, insufficient capacity and foreign tables are rejected');
  const conflict = await request('/reservations', diner, 'POST', {
    user_id: diner.user.id, restaurant_id: source.id, table_id: tables[2].id, slot_id: nextSlot.id, guest_count: 1,
  }, 201);
  await modify({ ...modification, slot_id: nextSlot.id, table_ids: [tables[2].id] }, 400);
  const afterFailure = await request(`/reservations/${booking.id}`, diner);
  assert.equal(afterFailure.slot_id, slot.id);
  assert.deepEqual(afterFailure.table_ids, modification.table_ids);
  const unchangedSlots = await request(`/tableslots?restaurant_id=${source.id}`);
  modification.table_ids.forEach((id) => assert.equal(unchangedSlots.find((entry) => entry.table_id === id && entry.slot_id === slot.id).status, 'reserved'));
  passed('availability conflict preserves every original allocation');
  const switched = await modify({ restaurant_id: target.id, slot_id: targetSlot.id,
    table_ids: [targetTables[0].id, targetTables[1].id], guest_count: 3 });
  assert.equal(switched.restaurant_id, target.id);
  assert.equal(switched.payment_summary.amount, payment.amount);
  assert.equal((await request(`/payments?reservation_id=${booking.id}`, diner))[0].restaurant_id, source.id);
  const payouts = await request('/finance/payouts', 'finance_admin');
  assert.equal(payouts.find((item) => item.restaurant_id === source.id).pending_reservation_count, 0);
  assert.equal(payouts.find((item) => item.restaurant_id === target.id).pending_reservation_count, 1);
  const managerRevenue = await request(`/restaurants/${target.id}/revenue`, otherManager);
  assert.equal(managerRevenue.pending_payout, payouts.find((item) => item.restaurant_id === target.id).pending_payout);
  assert.equal(switched.modifications_remaining, 0);
  await modify({ ...modification, slot_id: nextSlot.id }, 400);
  assert.equal((await request(`/reservations/${booking.id}`, diner)).modification_count, 2);
  const noChange = await modify({ restaurant_id: target.id, slot_id: targetSlot.id, table_ids: switched.table_ids, guest_count: 3 });
  assert.equal(noChange.modification_count, 2);
  passed('two successful changes exhaust the limit; unchanged retries do not count; original receipt and destination payout agree');
  assert.ok((await request(`/reservations?restaurant_id=${target.id}`, otherManager)).some((item) => item.id === booking.id));
  assert.ok(!(await request(`/reservations?restaurant_id=${source.id}`, manager)).some((item) => item.id === booking.id));
  passed('switched reservation appears in the new restaurant manager list');

  const ticket = new FormData();
  Object.entries({ raised_by_user_id: diner.user.id, raised_by_role: 'diner', category: 'other',
    subject: 'Unable to check in', description: 'Unable to check in', issue_code: 'checkin_problem',
    reservation_id: booking.id }).forEach(([key, value]) => ticket.append(key, value));
  const submitted = await request('/support/tickets', diner, 'POST', ticket, 201);
  assert.equal(submitted.linked_reservation_id, booking.id);
  assert.equal(submitted.linked_restaurant_id, target.id);
  assert.equal(submitted.issue_code, 'checkin_problem');
  assert.ok((await request(`/support/tickets/mine?user_id=${diner.user.id}`, diner)).some((item) => item.id === submitted.id));
  passed('support needs no typed note for common issues and automatically links the reservation');
  ticket.set('issue_code', 'other');
  await request('/support/tickets', diner, 'POST', ticket, 400);
  ticket.set('issue_note', 'A short note');
  await request('/support/tickets', diner, 'POST', ticket, 201);
  ticket.set('reservation_id', 'unknown');
  await request('/support/tickets', diner, 'POST', ticket, 400);
  passed('Other requires a short note and invalid reservation links are rejected');

  const menu = await request(`/menu?restaurant_id=${target.id}`);
  const dish = menu.find((item) => item.availability);
  const orderBody = { reservation_id: booking.id, items: [{ item_id: dish.id, quantity: 2, price: 0 }] };
  await request('/orders', diner, 'POST', orderBody, 410);
  passed('menus remain readable but order placement is retired');
  const destinationStaff=await request('/users',otherManager,'POST',{name:'Destination Staff',email:'destination.staff@example.test',phone:'9222222222',password_hash:'password123',role:'staff',restaurant_id:target.id,status:'active'},201);
  const destinationAuth=await request('/auth/login',null,'POST',{email:destinationStaff.email,password:'password123'},201);
  await request('/checkin', destinationAuth, 'POST', { reservation_id: booking.id, staff_id: destinationStaff.id }, 201);
  const occupied = await request(`/tableslots?restaurant_id=${target.id}`);
  switched.table_ids.forEach((id) => assert.equal(occupied.find((entry) => entry.table_id === id && entry.slot_id === targetSlot.id).status, 'occupied'));
  passed('staff check-in occupies every selected table');
  await modify({ ...modification }, 400);
  passed('checked-in reservations cannot be modified');
  await request('/orders', diner, 'POST', orderBody, 410);
  assert.deepEqual(await request(`/orders?reservation_id=${booking.id}`, otherManager), []);
  passed('check-in does not enable online order placement');
  await request(`/reservations/${booking.id}`, otherManager, 'PATCH', { reservation_status: 'completed' });
  const freed = await request(`/tableslots?restaurant_id=${target.id}`);
  switched.table_ids.forEach((id) => assert.equal(freed.find((entry) => entry.table_id === id && entry.slot_id === targetSlot.id).status, 'available'));
  passed('completion frees all selected tables');
  const cancelled = await request(`/reservations/${conflict.id}`, diner, 'PATCH', { reservation_status: 'cancelled' });
  assert.equal(cancelled.reservation_status, 'cancelled');
  const cancelBooking = await request('/reservations', diner, 'POST', {
    user_id: diner.user.id, restaurant_id: source.id, table_id: tables[0].id, slot_id: slot.id, guest_count: 1,
  }, 201);
  const cancelPayment = await request('/payments', diner, 'POST', {
    reservation_id: cancelBooking.id, payment_method: 'upi', transaction_ref: 'CANCEL-MODIFIED-TEST', payment_status: 'paid',
  }, 201);
  await request(`/reservations/${cancelBooking.id}/modify`, diner, 'PATCH', {
    restaurant_id: source.id, slot_id: slot.id, table_ids: [tables[0].id, tables[1].id], guest_count: 3,
  });
  const refund = await request(`/reservations/${cancelBooking.id}`, diner, 'PATCH', { reservation_status: 'cancelled' });
  assert.equal(refund.payment_summary.amount, cancelPayment.amount);
  assert.equal(refund.payment_summary.refunded_amount, cancelPayment.deposit_amount);
  const availableAfterCancel = await request(`/tableslots?restaurant_id=${source.id}`);
  [tables[0].id, tables[1].id].forEach((id) => assert.equal(availableAfterCancel.find((entry) => entry.table_id === id && entry.slot_id === slot.id).status, 'available'));
  passed('cancellation frees all modified tables and refunds only the original deposit');
  const deleteBooking = await request('/reservations', diner, 'POST', {
    user_id: diner.user.id, restaurant_id: source.id, table_id: tables[0].id, slot_id: slot.id, guest_count: 1,
  }, 201);
  await request(`/reservations/${deleteBooking.id}/modify`, diner, 'PATCH', {
    restaurant_id: source.id, slot_id: slot.id, table_ids: [tables[0].id, tables[1].id], guest_count: 3,
  }, 400);
  await request(`/reservations/${deleteBooking.id}`, diner, 'DELETE');
  const availableAfterDelete = await request(`/tableslots?restaurant_id=${source.id}`);
  [tables[0].id, tables[1].id].forEach((id) => assert.equal(availableAfterDelete.find((entry) => entry.table_id === id && entry.slot_id === slot.id).status, 'available'));
  passed('unpaid holds cannot be modified; abandoning the hold frees its table');
  console.log(`${checks} feature checks passed.`);
}

main().catch((error) => { console.error(error); console.error(output.slice(-6000)); process.exitCode = 1; })
  .finally(async () => {
    server.kill();
    await wait(500);
    assert.equal(resolve(dirname(runtime)), resolve(tmpdir()));
    assert.ok(basename(runtime).startsWith('dinetime-reservation-tests-'));
    rmSync(runtime, { recursive: true, force: true });
  });
