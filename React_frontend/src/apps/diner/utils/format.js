export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export function timeLabel(time) {
  if (!time) return "—";
  const [hours, minutes = "00"] = time.split(":");
  return `${Number(hours) % 12 || 12}:${minutes.slice(0, 2)} ${Number(hours) >= 12 ? "PM" : "AM"}`;
}

export function timeRangeLabel(start, end) {
  if (!start || !end) return timeLabel(start);
  return `${timeLabel(start)} – ${timeLabel(end)}`;
}

export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function statusLabel(status) {
  return (
    {
      reserved: "Confirmed",
      checked_in: "Checked In",
      completed: "Completed",
      cancelled: "Cancelled",
      no_show: "No Show",
    }[status] || status
  );
}
