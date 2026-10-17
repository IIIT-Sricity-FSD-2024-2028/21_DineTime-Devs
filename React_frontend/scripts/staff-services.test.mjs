import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const source = (
  await readFile(new URL("../src/apps/restaurant-staff/api/staffApi.js", import.meta.url), "utf8")
)
  .replace(/^import .*;\r?\n/gm, "")
  .replaceAll("import.meta.env", "({})")
  .replace("export const staffApi =", "globalThis.staffApi =");
function fixture() {
  const context = {
    readBoundSession: () => ({
      access_token: "fixture",
      user: { id: "staff-test", role: "staff", restaurantId: "r" },
    }),
    toIsoDate: () => "2030-01-01",
    bindSession: (value) => value,
    sessionStorage: { setItem() {}, removeItem() {} },
  };
  runInNewContext(source, context);
  const api = context.staffApi;
  api.restaurantVerified = true;
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
  api.request = async (path, options = {}) => {
    if (options.method === "PATCH") {
      writes.push(options.body);
      return {};
    }
    return values[path] || [];
  };
  return { api, writes };
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
  await api.updateTableStatus(table.id, table.slotIds, "Occupied");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].slot_id, "s1");
});
