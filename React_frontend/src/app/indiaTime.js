export function indiaToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export const slotInstant = (date, time) =>
  Date.parse(`${date}T${String(time || "00:00").slice(0, 8)}+05:30`);
export const isPastSlot = (slot) =>
  !slot || slotInstant(slot.slot_date || slot.date, slot.start_time || slot.time) <= Date.now();
export const indiaTime = (date = new Date()) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
