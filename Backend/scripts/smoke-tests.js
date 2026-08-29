const { spawn } = require('node:child_process');
const { setTimeout: wait } = require('node:timers/promises');

const port = Number(process.env.SMOKE_TEST_PORT || 3100);
const baseUrl = `http://localhost:${port}`;
const server = spawn(process.execPath, ['start.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
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
  for (let attempt = 0; attempt < 40; attempt += 1) {
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

async function main() {
  await waitForServer();

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

  await expect('frontend role header still lists restaurants', async () => {
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
    const available = tableSlots.find((item) => item.status === 'available');
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

    await fetch(`${baseUrl}/reservations/${reservationBody.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        role: 'staff',
      },
      body: JSON.stringify({ reservation_status: 'checked_in' }),
    });

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
  })
  .catch((error) => {
    console.error(serverOutput);
    console.error(error);
    process.exitCode = 1;
  });
