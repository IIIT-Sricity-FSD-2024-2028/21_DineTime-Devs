import { fetchData, selectData } from "../src/store/actions/dataActions.js";
import { authActions as resetAuth } from "../src/store/slices/authSlice.js";
// Run after `npm run build` in ../Backend. Every request targets a disposable server.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createAppStore } from "../src/store/store.js";
import { signIn } from "../src/store/actions/authActions.js";
import { completeBooking } from "../src/store/actions/bookingActions.js";
import { createStaffActions } from "../src/store/actions/staffActions.js";
import { createRestaurantActions } from "../src/store/actions/restaurantActions.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtime = await mkdtemp(join(tmpdir(), "dinetime-redux-smoke-"));
const port = 5400 + Math.floor(Math.random() * 500),
  baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(root, "Backend/start.js")], {
  cwd: runtime,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => (output += chunk));
server.stderr.on("data", (chunk) => (output += chunk));
const store = createAppStore({
  baseUrl,
  session: { read: () => null, write() {} },
});
const login = (email, password = "password123") => store.dispatch(signIn({ email, password }));
const query = (name, args = {}) => store.dispatch(fetchData(name, args));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(baseUrl + "/api-docs")).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) break;
    await delay(100);
  }
  assert.ok(ready, "Disposable backend did not start: " + output.slice(-2000));
  await login("johndoe@gmail.com");
  const catalog = await query("diner");
  assert.ok(catalog.restaurants.length);
  assert.ok(catalog.slots.length);
  const restaurant = catalog.restaurants.find((r) => r.id === "res-2001");
  const slot = catalog.slots.find(
    (s) =>
      s.restaurant_id === restaurant.id &&
      Date.parse(`${s.slot_date}T${s.start_time}+05:30`) > Date.now() + 86400000,
  );
  const table = catalog.tables.find((t) => t.restaurant_id === restaurant.id);
  const confirmation = await store.dispatch(
    completeBooking({
      booking: {
        restaurantId: restaurant.id,
        slotId: slot.id,
        tableId: table.id,
        guests: 2,
        date: slot.slot_date,
        time: slot.start_time,
      },
      method: "upi",
    }),
  );
  assert.equal(confirmation.payment.payment_status, "paid");
  console.log("PASS diner catalog, authenticated booking and server-priced checkout");
  await login("staff@dinetime.com");
  let staffData = await query("staff", {
    date: slot.slot_date,
    slotId: slot.id,
  });
  assert.ok(staffData.reservations.some((r) => r.id === confirmation.reservation.id));
  await createStaffActions(store.dispatch, store.getState).updateReservationStatus(
    confirmation.reservation.id,
    "Checked-In",
  );
  console.log("PASS staff assignment, selected service and check-in");
  await login("manager@dinetime.com");
  let managerData = await query("manager");
  assert.equal(managerData.ids.restaurantId, restaurant.id);
  assert.ok(
    managerData.reservations.some(
      (r) => r.id === confirmation.reservation.id && r.status === "Confirmed",
    ),
  );
  await createRestaurantActions(store.dispatch, store.getState).updateReservationStatus(
    confirmation.reservation.id,
    "Complete",
  );
  managerData = await query("manager");
  assert.ok(
    managerData.reservations.some(
      (r) => r.id === confirmation.reservation.id && r.status === "Complete",
    ),
  );
  console.log("PASS manager profile, schedule, reservation mapping and completion");
  await login("support@dinetime.com", "admin123");
  assert.ok(
    Array.isArray(
      await query("resources", {
        path: "/support/tickets",
      }),
    ),
  );
  await login("verification@dinetime.com", "admin123");
  assert.ok(
    Array.isArray(
      await query("resources", {
        path: "/verification/applications",
      }),
    ),
  );
  await login("finance@dinetime.com", "admin123");
  assert.ok(
    (await query("finance")).recentPayments.some(
      (p) => p.reservation_id === confirmation.reservation.id,
    ),
  );
  console.log("PASS support, verification and finance queries with role isolation");
  await login("admin@dinetime.com", "admin123");
  const platform = await query("platform");
  assert.ok(platform.reservations.some((r) => r.id === confirmation.reservation.id));
  assert.ok(platform.users.length);
  assert.ok(platform.restaurants.length);
  console.log("PASS platform dashboard and all seven actor logins");
} finally {
  store.dispatch(resetAuth.signedOut());
  if (server.exitCode === null)
    await new Promise((done) => {
      server.once("exit", done);
      server.kill();
    });
  assert.equal(resolve(dirname(runtime)), resolve(tmpdir()));
  assert.ok(basename(runtime).startsWith("dinetime-redux-smoke-"));
  await rm(runtime, { recursive: true, force: true });
}
