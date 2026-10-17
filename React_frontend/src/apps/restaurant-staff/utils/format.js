import { indiaToday } from "../../../app/indiaTime.js";
/** Format a time string like "18:00:00" → "6:00 PM". Mirrors diner/utils/format.js. */
export function timeLabel(time) {
  if (!time) return "—";
  const [hours, minutes = "00"] = time.split(":");
  return `${Number(hours) % 12 || 12}:${minutes.slice(0, 2)} ${Number(hours) >= 12 ? "PM" : "AM"}`;
}

/** Return today's date in YYYY-MM-DD format. */
export function toIsoDate(date = new Date()) {
  return indiaToday(date);
}

/** Map API reservation_status → human-readable label. */
export function statusLabel(status) {
  return (
    {
      reserved: "Upcoming",
      checked_in: "Checked-In",
      completed: "Checked-In",
      cancelled: "No-Show",
      no_show: "No-Show",
    }[status] || status
  );
}

/** Map table API status → display capitalised string. */
export function tableStatusLabel(status) {
  return (
    {
      available: "Available",
      reserved: "Reserved",
      occupied: "Occupied",
      blocked: "Blocked",
    }[status] || "Available"
  );
}
