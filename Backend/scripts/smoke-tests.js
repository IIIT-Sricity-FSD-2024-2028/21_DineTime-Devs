const { spawn } = require('node:child_process');
const { setTimeout: wait } = require('node:timers/promises');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, dirname, basename } = require('node:path');
const runtimeDirectory = mkdtempSync(join(tmpdir(), 'dinetime-smoke-tests-'));

const port = Number(process.env.SMOKE_TEST_PORT || (3200 + Math.floor(Math.random() * 1000)));
const baseUrl = `http://localhost:${port}`;
const server = spawn(process.execPath, process.env.PHASE_ONE_BOOTSTRAP ? ['-r',process.env.PHASE_ONE_BOOTSTRAP,resolve(process.env.PHASE_ONE_BUILD,'main.js')] : [resolve(__dirname, '../start.js')], {
  cwd: runtimeDirectory,
  env: {
    ...process.env,
    PORT: String(port),
    DINETIME_DB_PATH:join(runtimeDirectory,'data/dinetime.sqlite'),
    CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api-docs`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
    }

    await wait(250);
  }

  throw new Error(`Server did not start on ${baseUrl}\n${serverOutput}`);
}

async function expect(name, fn) {
  try {
    const value = await fn();
    console.log(`PASS ${name}: ${value}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function parseJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const originalFetch=global.fetch;
const tokens={};
async function fetch(url,options={}) {
  const role=options.headers?.role;
  if(role && !options.headers.Authorization && !String(url).endsWith('/auth/login')) {
    if(!tokens[role]) {
      const credentials={diner:['johndoe@gmail.com','password123'],manager:['manager@dinetime.com','password123'],staff:['staff@dinetime.com','password123'],verification_admin:['verification@dinetime.com','admin123']}[role];
      if(credentials){const response=await originalFetch(baseUrl+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:credentials[0],password:credentials[1]})});tokens[role]=(await response.json()).access_token;}
    }
    if(tokens[role])options={...options,headers:{...options.headers,Authorization:'Bearer '+tokens[role]}};
  }
  return originalFetch(url,options);
}
async function main() {
  await waitForServer();

  await expect('new manager stays closed and empty through verification, then opens after setup', async () => {
    const email = `workflow-${Date.now()}@example.com`;
    const form = new FormData();
    form.append('name', 'Workflow Manager');
    form.append('email', email);
    form.append('phone', '9012345678');
    form.append('password', 'workflow123');
    form.append('business_license_number', 'BL-WF-1234');
    form.append('location_id', 'loc_blr_1');
    form.append('restaurant_name', `Workflow Restaurant ${Date.now()}`);
    form.append('cuisine_type', 'Indian');
    form.append('description', 'Workflow smoke test restaurant');
    form.append('document', new Blob([Uint8Array.from([1, 2, 3])], { type: 'application/pdf' }), 'license.pdf');

    const registerResponse = await fetch(`${baseUrl}/managers/register`, { method: 'POST', body: form });
    const registered = await parseJson(registerResponse);
    const managerId = registered?.data?.manager?.id;
    const restaurantId = registered?.data?.restaurant?.id;
    if (!registerResponse.ok || !managerId || !restaurantId || registered.data.restaurant.is_open !== false || registered.data.restaurant.total_tables !== 0) {
      throw new Error(`Registration did not create a closed, empty restaurant: ${registerResponse.status} ${JSON.stringify(registered)}`);
    }

    const pendingLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'workflow123' }),
    });
    if (pendingLogin.ok) throw new Error('Manager was able to log in before verification');

    const pendingDinerList = await fetch(`${baseUrl}/restaurants`, { headers: { role: 'diner' } });
    const pendingRestaurants = (await parseJson(pendingDinerList)).data || [];
    if (pendingRestaurants.some((restaurant) => restaurant.id === restaurantId)) {
      throw new Error('Unverified restaurant was visible to diners');
    }
    const pendingBooking = await fetch(`${baseUrl}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', role: 'diner' },
      body: JSON.stringify({
        user_id: 'din-1234',
        restaurant_id: restaurantId,
        table_id: 'not-configured',
        slot_id: 'not-configured',
        guest_count: 2,
      }),
    });
    if (pendingBooking.status !== 400) {
      throw new Error(`Unverified restaurant booking was not rejected: ${pendingBooking.status} ${JSON.stringify(await parseJson(pendingBooking))}`);
    }

    const reviewResponse = await fetch(`${baseUrl}/verification/applications/${managerId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', role: 'verification_admin' },
      body: JSON.stringify({ decision: 'approved', reviewer_id: 'ver-0001' }),
    });
    if (!reviewResponse.ok) throw new Error(`Verification approval failed: ${reviewResponse.status} ${JSON.stringify(await parseJson(reviewResponse))}`);

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'workflow123' }),
    });
    const login = await parseJson(loginResponse);
    if (!loginResponse.ok || !login.access_token) throw new Error(`Approved manager could not log in: ${loginResponse.status} ${JSON.stringify(login)}`);

    tokens.manager=login.access_token;
    const [tablesResponse, slotsResponse, menuResponse] = await Promise.all([
      fetch(`${baseUrl}/tables?restaurant_id=${restaurantId}`, { headers: { role: 'manager' } }),
      fetch(`${baseUrl}/timeslots?restaurant_id=${restaurantId}`, { headers: { role: 'manager' } }),
      fetch(`${baseUrl}/menu?restaurant_id=${restaurantId}`, { headers: { role: 'manager' } }),
    ]);
    const [tables, slots, menu] = await Promise.all([tablesResponse, slotsResponse, menuResponse].map(async (response) => (await parseJson(response)).data || []));
    if (tables.length || slots.length || menu.length) {
      throw new Error(`Approved restaurant was unexpectedly preconfigured: tables=${tables.length}, slots=${slots.length}, menu=${menu.length}`);
    }

    const toggle = (isOpen) => fetch(`${baseUrl}/restaurants/${restaurantId}/serving-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', role: 'manager' },
      body: JSON.stringify({ manager_id: managerId, is_open: isOpen }),
    });
    const emptySetupToggle = await toggle(true);
    if (emptySetupToggle.ok) throw new Error('Restaurant opened before tables and time slots were configured');

    const tableResponse = await fetch(`${baseUrl}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', role: 'manager' },
      body: JSON.stringify({ restaurant_id: restaurantId, table_number: 1, capacity: 2 }),
    });
    if (!tableResponse.ok) throw new Error(`Manager could not add a table: ${tableResponse.status} ${JSON.stringify(await parseJson(tableResponse))}`);

    const futureDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const slotResponse = await fetch(`${baseUrl}/timeslots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', role: 'manager' },
      body: JSON.stringify({ restaurant_id: restaurantId, slot_date: futureDate, start_time: '18:00', end_time: '20:00' }),
    });
    if (!slotResponse.ok) throw new Error(`Manager could not add a time slot: ${slotResponse.status} ${JSON.stringify(await parseJson(slotResponse))}`);

    const openResponse = await toggle(true);
    if (!openResponse.ok) throw new Error(`Restaurant did not open after setup: ${openResponse.status} ${JSON.stringify(await parseJson(openResponse))}`);
    const visibleResponse = await fetch(`${baseUrl}/restaurants`, { headers: { role: 'diner' } });
    const visible = (await parseJson(visibleResponse)).data || [];
    if (!visible.some((restaurant) => restaurant.id === restaurantId)) throw new Error('Configured, verified, open restaurant was not visible to diners');

    delete tokens.manager;
    return 'registration pending/closed/empty → approval/login → manager configures table and slot → open/visible';
  });

  await expect('auth login returns bearer token', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@dinetime.com',
        password: 'password123',
      }),
    });
    const body = await parseJson(response);

    if (!response.ok || !body.access_token || body.user?.role !== 'manager') {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    return response.status;
  });

  await expect('authenticated catalog lists restaurants', async () => {
    const response = await fetch(`${baseUrl}/restaurants`, {
      headers: { role: 'diner' },
    });
    const body = await parseJson(response);

    if (!response.ok || !Array.isArray(body.data)) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    return `${body.data.length} restaurants`;
  });

  await expect('missing role returns consistent 401 JSON', async () => {
    const response = await fetch(`${baseUrl}/reservations`);
    const body = await parseJson(response);

    if (response.status !== 401 || !body.path || !body.timestamp || !body.message) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    return body.message;
  });

  await expect('jpeg upload appends and serves image URL', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([Uint8Array.from([255, 216, 255, 217])], { type: 'image/jpeg' }),
      'smoke.jpg',
    );

    const response = await fetch(`${baseUrl}/restaurants/res-2001/upload-image`, {
      method: 'POST',
      headers: { role: 'manager' },
      body: formData,
    });
    const body = await parseJson(response);
    const imageUrl = body?.data?.image_urls?.at(-1);

    if (!response.ok || !imageUrl?.startsWith('/uploads/restaurants/')) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    const staticResponse = await fetch(`${baseUrl}${imageUrl}`);
    if (!staticResponse.ok) {
      throw new Error(`static file returned ${staticResponse.status}`);
    }

    return imageUrl;
  });

  await expect('profile photo upload stores and serves URL', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'johndoe@gmail.com',
        password: 'password123',
      }),
    });
    const loginBody = await parseJson(loginResponse);
    const formData = new FormData();
    formData.append(
      'photo',
      new Blob([Uint8Array.from([255, 216, 255, 217])], { type: 'image/jpeg' }),
      'profile.jpg',
    );

    const response = await fetch(`${baseUrl}/users/${loginBody.user.id}/upload-photo`, {
      method: 'POST',
      headers: {
        role: 'diner',
        Authorization: `Bearer ${loginBody.access_token}`,
      },
      body: formData,
    });
    const body = await parseJson(response);
    const photoUrl = body?.data?.photo_url;

    if (!response.ok || !photoUrl?.startsWith('/uploads/profiles/')) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    const staticResponse = await fetch(`${baseUrl}${photoUrl}`);
    if (!staticResponse.ok) {
      throw new Error(`static file returned ${staticResponse.status}`);
    }

    return photoUrl;
  });

  let completedReservationForReview = null;

  await expect('diner can create reservation then payment', async () => {
    const [tablesResponse, slotsResponse, tableSlotsResponse] = await Promise.all([
      fetch(`${baseUrl}/tables?restaurant_id=res-2001`, { headers: { role: 'diner' } }),
      fetch(`${baseUrl}/timeslots?restaurant_id=res-2001`, { headers: { role: 'diner' } }),
      fetch(`${baseUrl}/tableslots?restaurant_id=res-2001`, { headers: { role: 'diner' } }),
    ]);
    const tables = (await parseJson(tablesResponse)).data;
    const slots = (await parseJson(slotsResponse)).data;
    const tableSlots = (await parseJson(tableSlotsResponse)).data;
    const available = tableSlots.find((item) => item.status === 'available' && new Date(slots.find((s)=>s.id===item.slot_id)?.slot_date+'T'+slots.find((s)=>s.id===item.slot_id)?.start_time+'+05:30').getTime()>Date.now());
    const table = tables.find((item) => item.id === available?.table_id);
    const slot = slots.find((item) => item.id === available?.slot_id);

    if (!table || !slot) {
      throw new Error('No available seeded table-slot found');
    }

    const reservationResponse = await fetch(`${baseUrl}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        role: 'diner',
      },
      body: JSON.stringify({
        user_id: 'din-1234',
        restaurant_id: 'res-2001',
        table_id: table.id,
        slot_id: slot.id,
        guest_count: Math.min(table.capacity, 4),
      }),
    });
    const reservationBody = await parseJson(reservationResponse);

    if (!reservationResponse.ok || !reservationBody?.data?.id) {
      throw new Error(`${reservationResponse.status} ${JSON.stringify(reservationBody)}`);
    }

    const paymentResponse = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        role: 'diner',
      },
      body: JSON.stringify({
        reservation_id: reservationBody.data.id,
        amount: 236,
        payment_method: 'upi',
        transaction_ref: `smoke_${Date.now()}`,
        payment_status: 'paid',
      }),
    });
    const paymentBody = await parseJson(paymentResponse);

    if (!paymentResponse.ok || !paymentBody?.data?.id) {
      throw new Error(`${paymentResponse.status} ${JSON.stringify(paymentBody)}`);
    }

    const managerReservationResponse = await fetch(`${baseUrl}/reservations?restaurant_id=res-2001`, {
      headers: { role: 'manager' },
    });
    const managerReservations = (await parseJson(managerReservationResponse)).data || [];
    if (!managerReservations.some((item) => item.id === reservationBody.data.id)) {
      throw new Error('Created reservation is not visible to manager restaurant view');
    }

    const checkinResponse = await fetch(`${baseUrl}/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        role: 'staff',
      },
      body: JSON.stringify({
        reservation_id: reservationBody.data.id,
        staff_id: 'rst-1234',
      }),
    });
    const checkinBody = await parseJson(checkinResponse);
    if (!checkinResponse.ok || checkinBody?.data?.reservation_id !== reservationBody.data.id) {
      throw new Error(`Staff check-in failed: ${checkinResponse.status} ${JSON.stringify(checkinBody)}`);
    }

    const syncedSlotsResponse = await fetch(`${baseUrl}/tableslots?restaurant_id=res-2001`, {
      headers: { role: 'staff' },
    });
    const syncedSlots = (await parseJson(syncedSlotsResponse)).data || [];
    const syncedSlot = syncedSlots.find((item) =>
      item.table_id === table.id && item.slot_id === slot.id,
    );
    if (syncedSlot?.status !== 'occupied') {
      throw new Error(`Table slot was not occupied after check-in: ${syncedSlot?.status}`);
    }

    const completeResponse = await fetch(`${baseUrl}/reservations/${reservationBody.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        role: 'manager',
      },
      body: JSON.stringify({ reservation_status: 'completed' }),
    });
    const completeBody = await parseJson(completeResponse);
    if (!completeResponse.ok || completeBody?.data?.reservation_status !== 'completed') {
      throw new Error(`Reservation did not complete: ${completeResponse.status} ${JSON.stringify(completeBody)}`);
    }

    completedReservationForReview = completeBody.data;

    return `${reservationBody.data.id} / ${paymentBody.data.id}`;
  });

  await expect('completed diner reservation can create manager-visible review', async () => {
    if (!completedReservationForReview) {
      throw new Error('No completed reservation available for review test');
    }

    const response = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        role: 'diner',
      },
      body: JSON.stringify({
        user_id: completedReservationForReview.user_id,
        restaurant_id: completedReservationForReview.restaurant_id,
        reservation_id: completedReservationForReview.id,
        rating: 5,
        comment: 'Smoke test review after completion',
      }),
    });
    const body = await parseJson(response);

    if (!response.ok || body?.data?.rating !== 5) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    const managerResponse = await fetch(`${baseUrl}/reviews?restaurant_id=${completedReservationForReview.restaurant_id}`, {
      headers: { role: 'manager' },
    });
    const managerReviews = (await parseJson(managerResponse)).data || [];
    if (!managerReviews.some((item) => item.id === body.data.id)) {
      throw new Error('Created review is not visible to manager reviews view');
    }

    const duplicateResponse = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        role: 'diner',
      },
      body: JSON.stringify({
        user_id: completedReservationForReview.user_id,
        restaurant_id: completedReservationForReview.restaurant_id,
        reservation_id: completedReservationForReview.id,
        rating: 4,
        comment: 'Duplicate should be rejected',
      }),
    });
    if (duplicateResponse.status !== 400) {
      throw new Error(`Duplicate review was not rejected: ${duplicateResponse.status}`);
    }

    const editResponse = await fetch(`${baseUrl}/reviews/${body.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        role: 'diner',
      },
      body: JSON.stringify({
        rating: 1,
        comment: 'Editing should be rejected',
      }),
    });
    if (editResponse.status !== 400) {
      throw new Error(`Review edit was not rejected: ${editResponse.status}`);
    }

    return body.data.id;
  });

  await expect('manager can block and unblock a table slot', async () => {
    const [tablesResponse, slotsResponse, tableSlotsResponse] = await Promise.all([
      fetch(`${baseUrl}/tables?restaurant_id=res-2001`, { headers: { role: 'manager' } }),
      fetch(`${baseUrl}/timeslots?restaurant_id=res-2001`, { headers: { role: 'manager' } }),
      fetch(`${baseUrl}/tableslots?restaurant_id=res-2001`, { headers: { role: 'manager' } }),
    ]);
    const tables = (await parseJson(tablesResponse)).data || [];
    const slots = (await parseJson(slotsResponse)).data || [];
    const tableSlots = (await parseJson(tableSlotsResponse)).data || [];
    const target = tableSlots.find((item) => item.status === 'available');
    const table = tables.find((item) => item.id === target?.table_id);
    const slot = slots.find((item) => item.id === target?.slot_id);

    if (!table || !slot) {
      throw new Error('No available table slot found for blocking test');
    }

    const blockResponse = await fetch(`${baseUrl}/tableslots/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        role: 'manager',
      },
      body: JSON.stringify({
        table_id: table.id,
        slot_id: slot.id,
        status: 'occupied',
      }),
    });
    const blockBody = await parseJson(blockResponse);
    if (!blockResponse.ok || blockBody?.data?.status !== 'occupied') {
      throw new Error(`Block failed: ${blockResponse.status} ${JSON.stringify(blockBody)}`);
    }

    const unblockResponse = await fetch(`${baseUrl}/tableslots/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        role: 'manager',
      },
      body: JSON.stringify({
        table_id: table.id,
        slot_id: slot.id,
        status: 'available',
      }),
    });
    const unblockBody = await parseJson(unblockResponse);
    if (!unblockResponse.ok || unblockBody?.data?.status !== 'available') {
      throw new Error(`Unblock failed: ${unblockResponse.status} ${JSON.stringify(unblockBody)}`);
    }

    return `${table.id} / ${slot.id}`;
  });

  await expect('pdf upload is rejected', async () => {
    const formData = new FormData();
    formData.append('image', new Blob(['x'], { type: 'application/pdf' }), 'bad.pdf');

    const response = await fetch(`${baseUrl}/restaurants/res-2001/upload-image`, {
      method: 'POST',
      headers: { role: 'manager' },
      body: formData,
    });
    const body = await parseJson(response);

    if (response.status !== 400) {
      throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }

    return body.message;
  });

  await expect('large upload is rejected', async () => {
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/png' }),
      'large.png',
    );

    const response = await fetch(`${baseUrl}/restaurants/res-2001/upload-image`, {
      method: 'POST',
      headers: { role: 'manager' },
      body: formData,
    });

    if (response.status !== 413) {
      throw new Error(`${response.status} ${JSON.stringify(await parseJson(response))}`);
    }

    return response.status;
  });

  await expect('helmet header is present', async () => {
    const response = await fetch(`${baseUrl}/restaurants`, {
      headers: { role: 'diner' },
    });
    const header = response.headers.get('x-content-type-options');

    if (header !== 'nosniff') {
      throw new Error(`x-content-type-options=${header}`);
    }

    return header;
  });

  await expect('uploaded assets allow cross-origin rendering', async () => {
    const response = await fetch(`${baseUrl}/uploads/profiles/does-not-exist.jpg`);
    const header = response.headers.get('cross-origin-resource-policy');

    if (header !== 'cross-origin') {
      throw new Error(`cross-origin-resource-policy=${header}`);
    }

    return header;
  });

  await expect('rate limit eventually returns 429', async () => {
    for (let count = 0; count < 120; count += 1) {
      const response = await fetch(`${baseUrl}/restaurants`, {
        headers: { role: 'diner' },
      });

      if (response.status === 429) {
        return response.status;
      }
    }

    throw new Error('No 429 response after 120 requests');
  });
}

main()
  .finally(async () => {
    server.kill();
    await wait(500);
    if (resolve(dirname(runtimeDirectory)) !== resolve(tmpdir()) ||
        !basename(runtimeDirectory).startsWith('dinetime-smoke-tests-')) {
      throw new Error('Refusing to remove an unexpected test runtime directory');
    }
    rmSync(runtimeDirectory, { recursive: true, force: true });
  })
  .catch((error) => {
    console.error(serverOutput);
    console.error(error);
    process.exitCode = 1;
  });
