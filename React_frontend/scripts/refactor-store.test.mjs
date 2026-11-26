import test from "node:test";
import assert from "node:assert/strict";
import { createAppStore } from "../src/store/store.js";
import { signIn } from "../src/store/actions/authActions.js";
import { loadDiner } from "../src/store/diner/dinerActions.js";
import { loadManager } from "../src/store/manager/managerActions.js";
import { loadStaff } from "../src/store/staff/staffActions.js";
import { loadPlatform, loadFinance } from "../src/store/admin/adminActions.js";

const session = { read: () => null, write() {} };
const response = (data, status = 200) => new Response(JSON.stringify({ data }), { status });

test("the store exposes concrete role slices instead of a generic entry cache", () => {
  const store = createAppStore({ session });
  assert.deepEqual(Object.keys(store.getState()).sort(), ["admin", "auth", "booking", "diner", "manager", "operations", "staff"]);
  assert.equal("entries" in store.getState().diner, false);
  assert.equal(store.getState().diner.status, "idle");
});

test("a named diner action loads the diner slice directly", async () => {
  const routes = {
    "/restaurants": [], "/menu": [], "/tables": [], "/timeslots": [], "/reviews": [],
    "/restaurants/locations": [], "/reservations?user_id=d1": [], "/notifications?user_id=d1": [],
  };
  const fetch = async (url, options = {}) => {
    const path = new URL(url).pathname + new URL(url).search;
    if (path === "/auth/login") return response({ access_token: "token", user: { id: "d1", role: "diner", status: "active", email: "d@example.com" } });
    assert.equal(options.headers.Authorization, "Bearer token");
    return response(routes[path] ?? []);
  };
  const store = createAppStore({ session, fetch, baseUrl: "http://example.test" });
  await store.dispatch(signIn({ email: "d@example.com", password: "secret" }, "diner"));
  await store.dispatch(loadDiner());
  const { diner } = store.getState();
  assert.equal(diner.status, "ready");
  assert.deepEqual(diner.restaurants, []);
  assert.deepEqual(diner.reservations, []);
});

test("each portal owns a plainly named state object", () => {
  const store = createAppStore({ session });
  store.dispatch(loadManager.fulfilled({ restaurant: { id: "r1" }, reservations: [] }, "m1"));
  store.dispatch(loadStaff.fulfilled({ tables: [{ id: "t1" }], reservations: [] }, "s1", { date: "2030-01-01", slotId: "slot1" }));
  store.dispatch(loadPlatform.fulfilled({ users: [{ id: "admin" }], restaurants: [] }, "a1"));
  store.dispatch(loadFinance.fulfilled({ refunds: [{ id: "refund1" }] }, "f1"));
  const { manager, staff, admin } = store.getState();
  assert.equal(manager.restaurant.id, "r1");
  assert.equal(staff.tables[0].id, "t1");
  assert.equal(admin.platform.users[0].id, "admin");
  assert.equal(admin.finance.refunds[0].id, "refund1");
});
