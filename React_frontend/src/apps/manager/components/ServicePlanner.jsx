import { useContext, useEffect, useState } from "react";
import { createAction } from "../../../app/actions.js";
import { indiaToday } from "../../../app/indiaTime.js";
import ManagerLayout from "./ManagerLayout.jsx";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";
import "../styles/service-planner.css";

const durations = [30, 60, 90, 120, 150, 180, 240];
const times = Array.from(
  { length: 48 },
  (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
);

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00Z`));
}
function rollingDates(today) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}
function minutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
function timeFromMinutes(value) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
function endTimeFor(start, duration) {
  return timeFromMinutes(minutes(start) + Number(duration));
}
function slotLength(start, end) {
  return (minutes(end) - minutes(start) + 1440) % 1440 || 1440;
}

function generatedSlots(open, close, duration, buffer = 0) {
  const span = (minutes(close) - minutes(open) + 1440) % 1440 || 1440;
  const result = [];
  const step = Number(duration) + Number(buffer);
  if (!step) return result;
  for (let elapsed = 0; elapsed + Number(duration) <= span; elapsed += step) {
    const start = (minutes(open) + elapsed) % 1440;
    const end = (start + Number(duration)) % 1440;
    result.push({
      start_time: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
      end_time: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
    });
  }
  return result;
}

function sameSlot(left, right) {
  return left.start_time === right.start_time && left.end_time === right.end_time;
}

function defaultWeeklyConfig(schedule) {
  const source = schedule?.weekly?.find((day) => !day.is_closed) || schedule?.weekly?.[0] || {};
  const open = source.open_time || "11:00";
  const close = source.close_time || "23:00";
  const duration = Number(source.slot_duration_minutes) || 120;
  const slots = Array.isArray(source.slots)
    ? source.slots.map((slot) => ({
        start_time: slot.start_time.slice(0, 5),
        end_time: slot.end_time.slice(0, 5),
      }))
    : schedule?.configured === false
      ? []
      : generatedSlots(open, close, duration, source.buffer_minutes || 0);
  return {
    open_time: open,
    close_time: close,
    slot_duration_minutes: duration,
    buffer_minutes: Number(source.buffer_minutes) || 0,
    is_closed: false,
    slots,
  };
}

function slotFitsHours(open, close, slot) {
  const operatingSpan = (minutes(close) - minutes(open) + 1440) % 1440 || 1440;
  const start = (minutes(slot.start_time) - minutes(open) + 1440) % 1440;
  const length = (minutes(slot.end_time) - minutes(slot.start_time) + 1440) % 1440 || 1440;
  return length <= operatingSpan && start + length <= operatingSpan;
}

function dateConfigFor(schedule, date) {
  const savedDate = schedule?.date_overrides?.[date];
  const weekly = defaultWeeklyConfig(savedDate ? { weekly: [savedDate] } : schedule);
  const rules = (schedule?.rules || []).filter(
    (rule) => rule.scope === "date" && rule.start_date === date,
  );
  const hours = rules.find((rule) => rule.type === "hours");
  const open = hours?.open_time || weekly.open_time;
  const close = hours?.close_time || weekly.close_time;
  let slots = weekly.slots
    .filter((slot) => slotFitsHours(open, close, slot))
    .map((slot) => ({ ...slot }));
  rules
    .filter((rule) => rule.type === "slot" && rule.slot_action === "remove")
    .forEach((rule) => {
      slots = slots.filter(
        (slot) => !(slot.start_time === rule.start_time && slot.end_time === rule.end_time),
      );
    });
  rules
    .filter(
      (rule) =>
        rule.type === "slot" && rule.slot_action === "add" && rule.start_time && rule.end_time,
    )
    .forEach((rule) => {
      if (
        !slots.some((slot) =>
          sameSlot(slot, { start_time: rule.start_time, end_time: rule.end_time }),
        )
      )
        slots.push({ start_time: rule.start_time, end_time: rule.end_time });
    });
  const isClosed = rules.some((rule) => rule.type === "closure");
  return {
    open_time: open,
    close_time: close,
    slot_duration_minutes: weekly.slot_duration_minutes,
    buffer_minutes: weekly.buffer_minutes,
    is_closed: isClosed,
    slots: isClosed ? [] : slots,
  };
}

function slotError(config, label) {
  if (config.is_closed)
    return config.slots.length ? `${label} is closed, so remove its time slots.` : "";
  const open = minutes(config.open_time);
  const operatingSpan = (minutes(config.close_time) - open + 1440) % 1440 || 1440;
  const seen = new Set();
  for (let index = 0; index < config.slots.length; index += 1) {
    const slot = config.slots[index];
    const key = `${slot.start_time}-${slot.end_time}`;
    if (seen.has(key)) return `${label} contains duplicate time slots.`;
    seen.add(key);
    const start = (minutes(slot.start_time) - open + 1440) % 1440;
    const length = slotLength(slot.start_time, slot.end_time);
    if (length !== Number(config.slot_duration_minutes))
      return `Slot ${index + 1} must end ${config.slot_duration_minutes} minutes after it starts.`;
    if (length > operatingSpan || start + length > operatingSpan)
      return `Slot ${index + 1} is outside the opening hours.`;
    for (let previous = 0; previous < index; previous += 1) {
      const other = config.slots[previous];
      const otherStart = (minutes(other.start_time) - open + 1440) % 1440;
      const otherLength = slotLength(other.start_time, other.end_time);
      if (start < otherStart + otherLength && otherStart < start + length)
        return `${label} contains overlapping time slots.`;
    }
  }
  return "";
}

function weeklyPayload(config) {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    is_closed: false,
    open_time: config.open_time,
    close_time: config.close_time,
    slot_duration_minutes: Number(config.slot_duration_minutes),
    buffer_minutes: Number(config.buffer_minutes) || 0,
    slots: config.slots.map((slot) => ({ start_time: slot.start_time, end_time: slot.end_time })),
  }));
}

function SlotEditor({
  title,
  slots,
  onAdd,
  onUpdate,
  onRemove,
  busy,
  ready,
  disabled = false,
  error = "",
  bookedSlots = [],
}) {
  return (
    <div className="weekly-slot-editor">
      <div className="weekly-slot-heading">
        <strong>{title}</strong>
        <button
          type="button"
          className="planner-button secondary"
          disabled={busy || !ready || disabled}
          onClick={onAdd}
        >
          + Add slot
        </button>
      </div>
      <div className="weekly-slot-grid">
        {slots.map((slot, index) => {
          const reservation = bookedSlots.find((record) => sameSlot(record, slot));
          const locked = Boolean(reservation);
          const unavailable = busy || !ready || disabled || locked;
          return (
            <div
              className={`weekly-slot-row ${locked ? "is-booked" : ""}`}
              key={`${index}-${slot.start_time}-${slot.end_time}`}
            >
              <span>
                Slot {index + 1}
                {locked && (
                  <small className="planner-status amber">
                    Booked
                    {reservation.reservation_count ? ` · ${reservation.reservation_count}` : ""}
                  </small>
                )}
              </span>
              <label>
                Start
                <select
                  aria-label={`${title} slot ${index + 1} start`}
                  disabled={unavailable}
                  value={slot.start_time}
                  onChange={(event) => onUpdate(index, "start_time", event.target.value)}
                >
                  {times.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                End
                <select
                  aria-label={`${title} slot ${index + 1} end`}
                  disabled={unavailable}
                  value={slot.end_time}
                  onChange={(event) => onUpdate(index, "end_time", event.target.value)}
                >
                  {times.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="planner-button secondary"
                aria-label={`Remove ${title} slot ${index + 1}`}
                disabled={unavailable}
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
      {!slots.length && <p className="planner-empty-inline">No time slots configured.</p>}
      {error && <p className="planner-inline-error">{error}</p>}
    </div>
  );
}

export default function ServicePlanner() {
  const { data, storage, refresh, ready, params } = useContext(ManagerContext);
  const { showToast } = useContext(ToastContext);
  const today = indiaToday();
  const dates = rollingDates(today);
  const [weeklyConfig, setWeeklyConfig] = useState(() => defaultWeeklyConfig(data.schedule));
  const [selectedDate, setSelectedDate] = useState(() =>
    params?.date && dates.includes(params.date) ? params.date : dates[0],
  );
  const [dateConfig, setDateConfig] = useState(() => dateConfigFor(data.schedule, dates[0]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const bookedSlots = (data.slotRecords || []).filter(
    (slot) =>
      slot.slot_date === selectedDate &&
      (slot.reservation_count > 0 ||
        (data.tableSlotRecords || []).some(
          (entry) => entry.slot_id === slot.id && ["reserved", "occupied"].includes(entry.status),
        )),
  );
  const hasDateReservations = bookedSlots.length > 0;
  const weeklyError = slotError(weeklyConfig, "Weekly");
  const dateError = slotError(dateConfig, "Date");

  useEffect(() => setWeeklyConfig(defaultWeeklyConfig(data.schedule)), [data.schedule?.weekly]);
  useEffect(() => {
    if (params?.date && dates.includes(params.date)) setSelectedDate(params.date);
  }, [params?.date, dates.join(",")]);
  useEffect(
    () => setDateConfig(dateConfigFor(data.schedule, selectedDate)),
    [selectedDate, data.schedule?.weekly, data.schedule?.rules, data.schedule?.date_overrides],
  );

  async function reload() {
    await storage.refreshFromBackend();
    refresh();
  }

  function updateConfigField(setter, field, value) {
    setter((current) => {
      const next = { ...current, [field]: value };
      if (field === "is_closed") next.slots = value ? [] : current.slots;
      if (field === "slot_duration_minutes")
        next.slots = current.slots.map((slot) => ({
          ...slot,
          end_time: endTimeFor(slot.start_time, value),
        }));
      return next;
    });
  }

  function updateSlot(setter, index, field, value) {
    setter((current) => ({
      ...current,
      slots: current.slots.map((slot, slotIndex) => {
        if (slotIndex !== index) return slot;
        return field === "start_time"
          ? {
              ...slot,
              start_time: value,
              end_time: endTimeFor(value, current.slot_duration_minutes),
            }
          : { ...slot, [field]: value };
      }),
    }));
  }
  function addSlot(setter) {
    setter((current) => {
      const candidates = generatedSlots(
        current.open_time,
        current.close_time,
        current.slot_duration_minutes,
        current.buffer_minutes,
      );
      const candidate = candidates.find(
        (item) => !current.slots.some((slot) => sameSlot(slot, item)),
      );
      if (!candidate) return current;
      return { ...current, slots: [...current.slots, candidate] };
    });
  }
  function removeSlot(setter, index) {
    setter((current) => ({
      ...current,
      slots: current.slots.filter((_, slotIndex) => slotIndex !== index),
    }));
  }

  function saveWeekly(event) {
    event.preventDefault();
    if (weeklyError) {
      setError(weeklyError);
      return;
    }
    run(async () => {
      await storage.updateWeeklySchedule(weeklyPayload(weeklyConfig));
      await reload();
      showToast("Weekly time slots saved.");
    });
  }

  function saveDate(event) {
    event.preventDefault();
    if (dateError) {
      setError(dateError);
      return;
    }
    run(async () => {
      await storage.updateDateSchedule({
        start_date: selectedDate,
        is_closed: dateConfig.is_closed,
        open_time: dateConfig.open_time,
        close_time: dateConfig.close_time,
        slots: dateConfig.slots,
      });
      await reload();
      showToast(`Date override saved for ${dateLabel(selectedDate)}.`);
    });
  }

  function revertDate() {
    run(async () => {
      await storage.resetDateSchedule(selectedDate);
      await reload();
      showToast(`${dateLabel(selectedDate)} reverted to weekly.`);
    });
  }

  return (
    <ManagerLayout
      title="Time Slot Management"
      description="Weekly defaults and date overrides."
      pageClassName="service-planner"
    >
      <section className="weekly-default-card service-hours">
        <div className="section-heading">
          <div>
            <span className="planner-eyebrow">WEEKLY DEFAULT</span>
            <h2>Opening hours and slots</h2>
          </div>
        </div>
        <form onSubmit={saveWeekly}>
          <div className="weekly-default-form">
            <label>
              Opening time
              <select
                value={weeklyConfig.open_time}
                onChange={(event) =>
                  updateConfigField(setWeeklyConfig, "open_time", event.target.value)
                }
              >
                {times.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Closing time
              <select
                value={weeklyConfig.close_time}
                onChange={(event) =>
                  updateConfigField(setWeeklyConfig, "close_time", event.target.value)
                }
              >
                {times.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Slot duration
              <select
                value={weeklyConfig.slot_duration_minutes}
                onChange={(event) =>
                  updateConfigField(
                    setWeeklyConfig,
                    "slot_duration_minutes",
                    Number(event.target.value),
                  )
                }
              >
                {durations.map((value) => (
                  <option key={value} value={value}>
                    {value} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <SlotEditor
            title="Weekly time slots"
            slots={weeklyConfig.slots}
            onAdd={() => addSlot(setWeeklyConfig)}
            onUpdate={(index, field, value) => updateSlot(setWeeklyConfig, index, field, value)}
            onRemove={(index) => removeSlot(setWeeklyConfig, index)}
            busy={busy}
            ready={ready}
            error={weeklyError}
          />
          <div className="planner-savebar">
            <strong>Weekly default</strong>
            <button className="planner-button" disabled={!ready || busy || Boolean(weeklyError)}>
              {busy ? "Saving..." : "Save weekly time slots"}
            </button>
          </div>
        </form>
      </section>
      {error && (
        <p role="alert" className="planner-alert error">
          {error}
        </p>
      )}
      <section className="service-day weekly-default-card">
        <form onSubmit={saveDate}>
          <div className="section-heading">
            <div>
              <span className="planner-eyebrow">PARTICULAR DATE</span>
              <h2>Date override</h2>
            </div>
          </div>
          <div className="planner-dropdowns">
            <label>
              Calendar date
              <select
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              >
                {dates.map((date) => (
                  <option key={date} value={date}>
                    {dateLabel(date)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="weekly-default-form date-override-form">
            <label>
              Status
              <select
                value={dateConfig.is_closed ? "closed" : "open"}
                onChange={(event) =>
                  updateConfigField(setDateConfig, "is_closed", event.target.value === "closed")
                }
              >
                <option value="open">Open</option>
                <option value="closed" disabled={hasDateReservations}>
                  Holiday / closed
                </option>
              </select>
            </label>
            <label>
              Opening time
              <select
                disabled={dateConfig.is_closed}
                value={dateConfig.open_time}
                onChange={(event) =>
                  updateConfigField(setDateConfig, "open_time", event.target.value)
                }
              >
                {times.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Closing time
              <select
                disabled={dateConfig.is_closed}
                value={dateConfig.close_time}
                onChange={(event) =>
                  updateConfigField(setDateConfig, "close_time", event.target.value)
                }
              >
                {times.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <SlotEditor
            title="Date time slots"
            slots={dateConfig.slots}
            onAdd={() => addSlot(setDateConfig)}
            onUpdate={(index, field, value) => updateSlot(setDateConfig, index, field, value)}
            onRemove={(index) => removeSlot(setDateConfig, index)}
            busy={busy}
            ready={ready}
            disabled={dateConfig.is_closed}
            error={dateError}
            bookedSlots={bookedSlots}
          />
          <div className="planner-savebar date-savebar">
            <strong>
              {dateConfig.is_closed
                ? "Holiday / closed"
                : `${dateConfig.open_time} – ${dateConfig.close_time}`}
            </strong>
            <div className="section-actions">
              <button className="planner-button" disabled={!ready || busy || Boolean(dateError)}>
                {busy ? "Saving..." : "Save date"}
              </button>
              <button
                type="button"
                className="planner-button secondary"
                disabled={!ready || busy}
                onClick={revertDate}
              >
                Revert to weekly
              </button>
            </div>
          </div>
        </form>
      </section>
    </ManagerLayout>
  );
}
