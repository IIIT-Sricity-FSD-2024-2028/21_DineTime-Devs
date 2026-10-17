import { slotInstant } from "../../../app/indiaTime.js";

export function arrangeLayout(tables) {
  const occupied = new Set();
  return tables.map((table, index) => {
    let x = table.x ?? (index % 4) * 2,
      y = table.y ?? Math.floor(index / 4) * 2;
    if (y > 15 || occupied.has(`${x},${y}`)) {
      const free = Array.from({ length: 128 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) })).find(
        (p) => !occupied.has(`${p.x},${p.y}`),
      );
      if (free) {
        x = free.x;
        y = free.y;
      }
    }
    occupied.add(`${x},${y}`);
    return { ...table, x, y, shape: table.shape || "square" };
  });
}
export function layoutEqual(a, b) {
  const normalize = (values) =>
    values
      .map(({ table_id, capacity, x, y, shape }) => ({
        table_id,
        capacity: Number(capacity),
        x,
        y,
        shape,
      }))
      .sort((x, y) => x.table_id.localeCompare(y.table_id));
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function sessionEnd(start) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return "";
  const [h, m] = start.split(":").map(Number);
  return `${String((h + 2) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sessionChoices(date, open, close, slots, now = Date.now()) {
  if (!date || !sessionEnd(open) || !sessionEnd(close)) return [];
  const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const opening = minutes(open),
    duration = (minutes(close) - opening + 1440) % 1440 || 1440;
  const choices = [];
  for (let offset = 0; offset + 120 <= duration; offset += 120) {
    const start = (opening + offset) % 1440;
    const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    const from = slotInstant(date, time),
      to = from + 7200000;
    if (
      from <= now ||
      slots.some((slot) => {
        const other = slotInstant(slot.slot_date, slot.start_time);
        return from < other + 7200000 && other < to;
      })
    )
      continue;
    choices.push(time);
  }
  return choices;
}
