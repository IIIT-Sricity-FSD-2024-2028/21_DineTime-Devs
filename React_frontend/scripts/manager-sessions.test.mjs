import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionChoices,
  sessionEnd,
  arrangeLayout,
  layoutEqual,
} from "../src/apps/manager/utils/sessions.js";

test("session choices fit daily hours and skip occupied intervals on adjacent dates", () => {
  const slots = [
    { slot_date: "2030-01-01", start_time: "23:00" },
    { slot_date: "2030-01-02", start_time: "20:00" },
  ];
  assert.deepEqual(sessionChoices("2030-01-02", "18:00", "02:00", slots, 0), ["18:00", "22:00"]);
  assert.deepEqual(sessionChoices("2030-01-02", "11:00", "18:00", [], 0), [
    "11:00",
    "13:00",
    "15:00",
  ]);
});

test("session choices handle 24-hour opening and exclude started sessions", () => {
  assert.equal(sessionChoices("2030-01-02", "00:00", "00:00", [], 0).length, 12);
  const now = Date.parse("2030-01-02T13:30:00+05:30");
  assert.deepEqual(sessionChoices("2030-01-02", "11:00", "18:00", [], now), ["15:00"]);
  assert.deepEqual(sessionChoices("", "11:00", "18:00", [], 0), []);
  assert.equal(sessionEnd("23:30"), "01:30");
  assert.equal(sessionEnd(""), "");
});

test("legacy floor plans gain positions without moving already positioned tables", () => {
  const arranged = arrangeLayout([
    { table_id: "a", capacity: 2, x: 0, y: 0, shape: "round" },
    { table_id: "b", capacity: 4, x: 0, y: 0 },
    { table_id: "c", capacity: 6 },
  ]);
  assert.deepEqual(arranged[0], { table_id: "a", capacity: 2, x: 0, y: 0, shape: "round" });
  assert.equal(new Set(arranged.map((t) => `${t.x},${t.y}`)).size, 3);
  assert.equal(arranged[1].shape, "square");
});

test("dirty checks ignore entry order and numeric input strings but include actual floor-plan edits", () => {
  const saved = arrangeLayout([
    { table_id: "a", capacity: 2 },
    { table_id: "b", capacity: 4 },
  ]);
  assert.equal(layoutEqual(saved, [{ ...saved[1], capacity: "4" }, saved[0]]), true);
  assert.equal(layoutEqual(saved, [{ ...saved[0], shape: "round" }, saved[1]]), false);
  assert.equal(layoutEqual(saved, [{ ...saved[0], x: 5 }, saved[1]]), false);
});

test("auto arrangement fits the maximum service size without collisions", () => {
  const arranged = arrangeLayout(
    Array.from({ length: 100 }, (_, index) => ({ table_id: String(index), capacity: 2 })),
  );
  assert.equal(new Set(arranged.map((t) => `${t.x},${t.y}`)).size, 100);
  assert.ok(arranged.every((t) => t.x >= 0 && t.x <= 7 && t.y >= 0 && t.y <= 15));
});
