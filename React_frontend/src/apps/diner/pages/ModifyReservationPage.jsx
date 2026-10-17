import { useContext, useEffect, useState } from "react";
import { createAction } from "../../../app/actions.js";
import { DinerContext } from "../context/DinerContext.js";
import { DinerLayout, Hero, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import { canModify } from "../components/ReservationCard.jsx";
import { money, timeLabel, timeRangeLabel, today } from "../utils/format.js";

function ModifyForm({ reservation }) {
  const { api, restaurants, tables: tableCatalog, slots, navigate } = useContext(DinerContext);
  const originalSlot = slots.find((item) => item.id === reservation.slot_id);
  const originalTables = reservation.table_ids || [reservation.table_id];
  const restaurantId = reservation.restaurant_id;
  const [date, setDate] = useState(originalSlot?.slot_date || originalSlot?.date || today());
  const [slotId, setSlotId] = useState(reservation.slot_id);
  const [guests, setGuests] = useState(reservation.guest_count);
  const [selected, setSelected] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const restaurant = restaurants.find((item) => item.id === restaurantId);
  const daySlots = slots.filter(
    (item) =>
      item.restaurant_id === restaurantId &&
      (item.slot_date || item.date) === date &&
      new Date(`${item.slot_date || item.date}T${item.start_time}`).getTime() > Date.now(),
  );
  const slot = daySlots.find((item) => item.id === slotId);
  const tables = tableCatalog.map((item) => ({
    ...item,
    capacity:
      slot?.table_layout?.find((entry) => entry.table_id === item.id)?.capacity ?? item.capacity,
  }));
  const chosen = tables.filter((item) => selected.includes(item.id));
  const capacity = chosen[0]?.capacity || 0;
  const seatRate = Number(restaurant?.reservation_fee_per_guest ?? 30);
  const initialTableSeats =
    reservation.initial_table_capacity ??
    tables.find((item) => item.id === originalTables[0])?.capacity ??
    0;
  const paidSeats = Number(reservation.paid_seat_count || 0);
  const additionalPayment = Math.max(0, capacity - paidSeats) * seatRate;
  const ownAllocation =
    restaurantId === reservation.restaurant_id && slotId === reservation.slot_id;

  useEffect(() => {
    setAvailability([]);
    setAvailabilityError("");
    if (!slotId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .availability(restaurantId, slotId, controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) setAvailability(entries);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setAvailabilityError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, restaurantId, slotId, slot, attempt]);

  function save(event) {
    event.preventDefault();
    if (!window.confirm("Are you sure you want to reschedule this reservation?")) return;
    run(async () => {
      if (!slot || !selected.length || capacity < Math.max(Number(guests), initialTableSeats)) {
        throw new Error(
          "Choose an upcoming time and a table that fits your guests and the original table size.",
        );
      }
      const updated = await api.modifyReservation(reservation.id, {
        restaurant_id: restaurantId,
        slot_id: slotId,
        table_ids: selected.slice(0, 1),
        guest_count: Number(guests),
      });
      if (Number(updated.additional_payment_due || 0) > 0 || additionalPayment > 0) {
        navigate("additional_payment", { id: reservation.id });
      } else navigate("details", { id: reservation.id });
    });
  }

  if (!canModify(reservation, originalSlot))
    return (
      <EmptyState
        title={
          (reservation.modification_history?.length || 0) >= 2
            ? "Reschedule limit reached"
            : "This reservation can no longer be modified"
        }
      >
        {(reservation.modification_history?.length || 0) >= 2
          ? "A reservation can be rescheduled up to two times."
          : "Changes are available before the reservation starts and before check-in."}
        <PageLink page="details" params={{ id: reservation.id }}>
          View Reservation
        </PageLink>
      </EmptyState>
    );
  return (
    <form onSubmit={save} className="modify-reservation-form">
      <fieldset disabled={busy}>
        <div className="reservation-layout">
          <div className="left-column">
            <section className="detail-card">
              <h2>Update Reservation Details</h2>
              <p className="section-subtitle">
                Your existing reservation stays booked until you save these changes.
              </p>
              <div className="modify-fields">
                <label>
                  Restaurant
                  <input value={restaurant?.name || reservation.restaurant_id} readOnly />
                </label>
                <label>
                  Date
                  <input
                    required
                    type="date"
                    min={today()}
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setSlotId("");
                      setSelected([]);
                    }}
                  />
                </label>
                <label>
                  Time
                  <select
                    required
                    value={slotId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSlotId(next);
                      setSelected([]);
                    }}
                  >
                    <option value="">Select Time</option>
                    {daySlots.map((item) => (
                      <option key={item.id} value={item.id}>
                        {timeRangeLabel(item.start_time, item.end_time)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Guests
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                  />
                </label>
              </div>
              {!daySlots.length && (
                <p>No available time slots on this date. Please choose another date.</p>
              )}
            </section>
            {slot && (
              <section className="detail-card">
                <h2>Select Tables</h2>
                <p className="section-subtitle">
                  Choose one table with at least {Math.max(Number(guests) || 1, initialTableSeats)}{" "}
                  seats. The original table size is the minimum.
                </p>
                {loading ? (
                  <p role="status">Checking table availability…</p>
                ) : (
                  <div className="table-grid">
                    {[...availability]
                      .sort((a, b) => {
                        const tableA = tables.find((item) => item.id === a.table_id);
                        const tableB = tables.find((item) => item.id === b.table_id);
                        return (tableA?.capacity || 0) - (tableB?.capacity || 0);
                      })
                      .map((entry) => {
                        const table = tables.find((item) => item.id === entry.table_id);
                        if (!table) return null;
                        if (table.capacity < Math.max(Number(guests) || 1, initialTableSeats))
                          return null;
                        const sameReservationTable =
                          ownAllocation && originalTables.includes(table.id);
                        const available = entry.status === "available" && !sameReservationTable;
                        return (
                          <button
                            type="button"
                            key={table.id}
                            className={`table-tile ${available ? "available" : "unavailable"} ${selected.includes(table.id) ? "selected" : ""}`}
                            disabled={!available}
                            aria-pressed={selected.includes(table.id)}
                            onClick={() => setSelected([table.id])}
                          >
                            <strong className="tile-name">Table {table.table_number}</strong>
                            <span className="tile-seats">{table.capacity} Seats</span>
                            <span>
                              {sameReservationTable
                                ? "Already booked for this time"
                                : available
                                  ? "Available"
                                  : "Unavailable"}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
                {availabilityError && (
                  <div role="alert">
                    <p>{availabilityError}</p>
                    <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                      Retry Availability
                    </button>
                  </div>
                )}
                {!loading && !availabilityError && !availability.length && (
                  <p>No tables are available for this time.</p>
                )}
              </section>
            )}
          </div>
          <aside className="right-column">
            <div className="summary-card">
              <h3>Updated Reservation</h3>
              <div className="summary-body">
                {[
                  ["Restaurant", restaurant?.name],
                  ["Date", date],
                  ["Time", timeLabel(slot?.start_time)],
                  ["Guests", guests],
                  [
                    "Tables",
                    chosen.map((item) => `Table ${item.table_number}`).join(", ") ||
                      "Choose tables",
                  ],
                  [
                    "Amount already paid",
                    reservation.payment_summary &&
                    ["paid", "refunded"].includes(reservation.payment_summary.payment_status)
                      ? money(reservation.payment_summary.amount)
                      : "Payment not recorded",
                  ],
                  ["Additional payment", money(additionalPayment)],
                ].map(([label, value]) => (
                  <div className="summary-row" key={label}>
                    <div>
                      <span className="summary-label">{label}</span>
                      <span className="summary-value">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="summary-hint">
                Your reservation stays at {restaurant?.name}. If due, you’ll review and pay the
                additional seat amount on the next page.
              </p>
              {error && (
                <p className="diner-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="btn-confirm"
                disabled={
                  busy ||
                  loading ||
                  Boolean(availabilityError) ||
                  !slot ||
                  !selected.length ||
                  capacity < Math.max(Number(guests) || 1, initialTableSeats)
                }
              >
                {busy ? "Saving…" : "Save Changes"}
              </button>
              <PageLink page="details" params={{ id: reservation.id }} className="btn-back">
                Keep Original Reservation
              </PageLink>
            </div>
          </aside>
        </div>
      </fieldset>
    </form>
  );
}

export default function ModifyReservationPage() {
  const { reservations, params } = useContext(DinerContext);
  const reservation = reservations.find((item) => item.id === params.id);
  return (
    <DinerLayout header={false}>
      <Hero
        title="Modify Reservation"
        subtitle="Change your date, time, guest count, or table at the original restaurant."
      />
      <div className="page-body container">
        {reservation ? (
          <ModifyForm reservation={reservation} key={reservation.id} />
        ) : (
          <DataState>
            <EmptyState title="Reservation not found">
              <PageLink page="reservations">My Reservations</PageLink>
            </EmptyState>
          </DataState>
        )}
      </div>
    </DinerLayout>
  );
}
