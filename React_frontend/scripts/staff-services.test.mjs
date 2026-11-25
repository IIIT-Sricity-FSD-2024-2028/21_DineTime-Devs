import { fetchData, selectData } from "../src/store/actions/dataActions.js";
import { authActions as resetAuth } from "../src/store/slices/authSlice.js";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createAppStore } from "../src/store/store.js";
import { createStaffActions } from "../src/store/actions/staffActions.js";
const stores = [];
afterEach(() => stores.splice(0).forEach((store) => store.dispatch(resetAuth.signedOut())));
function fixture() {
  const values = {
    "/tables": [
      { id: "t1", restaurant_id: "r", capacity: 2, table_number: 1 },
      { id: "t2", restaurant_id: "r", capacity: 4, table_number: 2 },
    ],
    "/timeslots": [
      {
        id: "s1",
        restaurant_id: "r",
        slot_date: "2030-01-01",
        start_time: "18:00",
        table_layout: [{ table_id: "t1", capacity: 7 }],
      },
      {
        id: "s2",
        restaurant_id: "r",
        slot_date: "2030-01-01",
        start_time: "20:00",
        table_layout: [
          { table_id: "t1", capacity: 3 },
          { table_id: "t2", capacity: 5 },
        ],
      },
    ],
    "/tableslots": [
      { table_id: "t1", slot_id: "s1", status: "available" },
      { table_id: "t1", slot_id: "s2", status: "occupied" },
      { table_id: "t2", slot_id: "s2", status: "available" },
    ],
    "/users": [],
    "/reservations?restaurant_id=r": [],
  };
  const writes = [];
  const store = createAppStore({
    session: {
      read: () => ({
        access_token: "fixture",
        user: { id: "staff-test", role: "staff", restaurantId: "r" },
      }),
      write() {},
    },
    fetch: async (url, options) => {
      const path = new URL(url).pathname + new URL(url).search;
      if (options.method === "PATCH") writes.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: structuredClone(values[path] || []) }),
      };
    },
  });
  stores.push(store);
  const api = createStaffActions(store.dispatch, store.getState);
  api.getSnapshot = () =>
    selectData(store.getState(), "staff", {
      scope: store.getState().auth.generation,
      date: store.getState().operations.date,
      slotId: store.getState().operations.slotId,
    })?.data;
  return { api, writes, values };
}
test("staff availability and capacity belong to the selected service", async () => {
  const { api } = fixture();
  await api.refresh("2030-01-01", "s1");
  assert.equal(api.getSnapshot().tables.length, 1);
  assert.equal(api.getSnapshot().tables[0].capacity, 7);
  assert.equal(api.getSnapshot().tables[0].computedStatus, "available");
  await api.refresh("2030-01-01", "s2");
  assert.equal(api.getSnapshot().tables.length, 2);
  assert.equal(api.getSnapshot().tables[0].capacity, 3);
  assert.equal(api.getSnapshot().tables[0].computedStatus, "occupied");
});
test("staff table updates target one service and do not alter the whole date", async () => {
  const { api, writes } = fixture();
  await api.refresh("2030-01-01", "s1");
  const table = api.getSnapshot().tables[0];
  await api.updateTableStatus(table.id, table.slotIds, "Blocked");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].slot_id, "s1");
});

test("manual holds and guest bookings are distinguished for the selected service", async () => {
  const { api, values } = fixture();
  values["/tableslots"][0].status = "reserved";
  await api.refresh("2030-01-01", "s1");
  assert.equal(api.getSnapshot().tables[0].bookingManaged, false);
  values["/reservations?restaurant_id=r"] = [
    {
      id: "booking",
      restaurant_id: "r",
      table_ids: ["t1", "t2"],
      slot_id: "s2",
      reservation_status: "checked_in",
    },
  ];
  await api.refresh("2030-01-01", "s1");
  assert.equal(api.getSnapshot().tables[0].bookingManaged, false);
  await api.refresh("2030-01-01", "s2");
  assert.ok(api.getSnapshot().tables.every((table) => table.bookingManaged));
  values["/reservations?restaurant_id=r"][0].reservation_status = "completed";
  await api.refresh("2030-01-01", "s2");
  assert.ok(api.getSnapshot().tables.every((table) => !table.bookingManaged));
});

test("staff blocked tables remain blocked in the selected service and send a block action", async () => {
  const { api, writes, values } = fixture();
  values["/tableslots"][0] = {
    table_id: "t1",
    slot_id: "s1",
    status: "blocked",
    schedule_block: true,
  };
  await api.refresh("2030-01-01", "s1");
  const table = api.getSnapshot().tables[0];
  assert.equal(table.computedStatus, "blocked");
  assert.equal(table.scheduleBlocked, true);
  await api.updateTableStatus("t2", ["s2"], "Blocked");
  assert.equal(writes[0].status, "blocked");
  assert.equal(writes[0].slot_id, "s2");
  await assert.rejects(api.updateTableStatus("t1", ["s1"], "Occupied"), /Available or Blocked/);
  assert.equal(writes.length, 1);
});
