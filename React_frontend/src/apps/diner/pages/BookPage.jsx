import { useEffect, useState, useContext } from "react";
import { DinerLayout, Icon, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState, ErrorMessage } from "../components/Feedback.jsx";
import { DinerContext } from "../context/DinerContext.js";
import { timeLabel, timeRangeLabel, today } from "../utils/format.js";

export default function BookPage() {
  const {
    api,
    restaurants,
    slots,
    tables: tableCatalog,
    params,
    navigate,
    booking,
    setBooking,
    user,
  } = useContext(DinerContext);
  const restaurant = restaurants.find((item) => item.id === params.id);
  const currentToday = today();
  const previous =
    booking?.restaurantId === params.id && booking?.date >= currentToday ? booking : null;
  const [date, setDate] = useState(previous?.date || currentToday);
  const [slotId, setSlotId] = useState(previous?.slotId || "");
  const [guests, setGuests] = useState(previous?.guests || "");
  const [selected, setSelected] = useState("");
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSlotInPast = (s) => {
    const slotDate = s.slot_date || s.date;
    if (!slotDate) return false;
    const todayStr = today();
    if (slotDate < todayStr) return true;
    if (slotDate === todayStr) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const [slotHours = "0", slotMinutes = "0"] = (s.start_time || "").split(":");
      const sH = Number(slotHours);
      const sM = Number(slotMinutes);
      if (sH < currentHours || (sH === currentHours && sM <= currentMinutes)) {
        return true;
      }
    }
    return false;
  };

  const daySlots = slots.filter(
    (slot) =>
      slot.restaurant_id === params.id &&
      (slot.slot_date || slot.date) === date &&
      !isSlotInPast(slot),
  );
  const slot = daySlots.find((item) => item.id === slotId);
  const tables = tableCatalog.map((item) => ({
    ...item,
    capacity:
      slot?.table_layout?.find((entry) => entry.table_id === item.id)?.capacity ?? item.capacity,
  }));
  const table = tables.find((item) => item.id === selected);

  useEffect(() => {
    api.refresh();
  }, [api, params.id, date]);

  useEffect(() => {
    if (slotId && !daySlots.some((s) => s.id === slotId)) {
      setSlotId("");
      setSelected("");
    }
  }, [date, daySlots, slotId]);

  useEffect(() => {
    setSelected("");
    setAvailability([]);
    setError("");
    if (!slotId) return;
    const controller = new AbortController();
    setLoading(true);
    api
      .availability(params.id, slotId, controller.signal)
      .then(setAvailability)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, params.id, slotId, slot]);

  function confirm() {
    if (!table || !slot) return;
    if (date < today() || isSlotInPast(slot)) {
      setError("Cannot book a table for a past date or time.");
      return;
    }
    setBooking({
      restaurantId: restaurant.id,
      slotId: slot.id,
      tableId: table.id,
      guests: Number(guests || table.capacity),
      date,
      time: slot.start_time,
    });
    navigate(user ? "payment_making" : "login");
  }

  return (
    <DinerLayout>
      <div className="page-body container">
        <DataState>
          {!restaurant ? (
            <EmptyState title="Choose a restaurant first">
              <PageLink page="browse">Browse restaurants</PageLink>
            </EmptyState>
          ) : restaurant.is_open === false || restaurant.is_closed ? (
            <EmptyState title="New reservations are paused">
              Existing bookings remain confirmed.{" "}
              <PageLink page="reservations">View My Reservations</PageLink>
            </EmptyState>
          ) : (
            <>
              <section className="restaurant-banner">
                <img src={restaurant.image} alt={restaurant.name} className="banner-img" />
                <div className="banner-info">
                  <h2>{restaurant.name}</h2>
                  <p className="banner-subtitle">
                    {restaurant.cuisine} - {restaurant.city}
                  </p>
                  <div className="banner-meta">
                    <span>
                      <Icon name="location-dot" /> {restaurant.location}
                    </span>
                    <span>
                      <Icon name="star" /> {restaurant.rating}
                    </span>
                  </div>
                </div>
              </section>
              <div className="reservation-layout">
                <div className="left-column">
                  <section className="detail-card">
                    <h2>Select Reservation Details</h2>
                    <div className="inputs-row">
                      <div className="input-group">
                        <label htmlFor="booking-date">Date</label>
                        <div className="input-box">
                          <Icon name="calendar" />
                          <input
                            id="booking-date"
                            type="date"
                            min={today()}
                            value={date}
                            onChange={(event) => {
                              const val = event.target.value;
                              if (val && val < today()) {
                                setDate(today());
                                setError("Booking date cannot be in the past.");
                              } else {
                                setDate(val);
                                setError("");
                              }
                              setSlotId("");
                            }}
                          />
                        </div>
                      </div>
                      <div className="input-group">
                        <label htmlFor="booking-time">Time</label>
                        <div className="input-box">
                          <Icon name="clock" />
                          <select
                            id="booking-time"
                            value={slotId}
                            onChange={(event) => setSlotId(event.target.value)}
                          >
                            <option value="">Select Time</option>
                            {daySlots.map((item) => (
                              <option key={item.id} value={item.id}>
                                {timeRangeLabel(item.start_time, item.end_time)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="input-group">
                        <label htmlFor="booking-guests">Guests</label>
                        <div className="input-box">
                          <Icon name="people-group" />
                          <select
                            id="booking-guests"
                            value={guests}
                            onChange={(event) => {
                              setGuests(event.target.value);
                              setSelected("");
                            }}
                          >
                            <option value="">Select Guests (Optional)</option>
                            {Array.from(
                              {
                                length: Math.max(
                                  6,
                                  ...tables
                                    .filter((item) => item.restaurant_id === params.id)
                                    .map((item) => item.capacity),
                                ),
                              },
                              (_, index) => index + 1,
                            ).map((count) => (
                              <option key={count} value={count}>
                                {count} {count === 1 ? "Guest" : "Guests"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    {!daySlots.length && (
                      <p className="section-subtitle">
                        {date === currentToday &&
                        slots.some(
                          (s) => s.restaurant_id === params.id && (s.slot_date || s.date) === date,
                        )
                          ? "Today's reservation slots have already passed. Please select tomorrow or an upcoming date."
                          : "No reservation slots are available on this date."}
                      </p>
                    )}
                  </section>
                  {slot && (
                    <section className="detail-card">
                      <h2>Available Tables</h2>
                      <p className="section-subtitle">
                        Select a table based on current availability
                      </p>
                      <div className="legend-row">
                        {["available", "reserved", "unavailable"].map((status) => (
                          <span className="legend-item" key={status}>
                            <span className={`legend-dot ${status}`} />
                            {status}
                          </span>
                        ))}
                      </div>
                      <hr className="divider" />
                      <ErrorMessage message={error} />
                      {loading ? (
                        <p role="status">Checking availability…</p>
                      ) : (
                        <div className="table-grid">
                          {[...availability]
                            .sort((a, b) => {
                              const tableA = tables.find((item) => item.id === a.table_id);
                              const tableB = tables.find((item) => item.id === b.table_id);
                              return (tableA?.capacity || 0) - (tableB?.capacity || 0);
                            })
                            .map((entry) => {
                              const item = tables.find(
                                (candidate) => candidate.id === entry.table_id,
                              );
                              if (!item) return null;
                              // Hide tables that cannot seat the requested guests at all
                              if (guests && item.capacity < Number(guests)) return null;
                              const available = entry.status === "available";
                              return (
                                <button
                                  key={entry.table_id}
                                  className={`table-tile ${available ? "available" : entry.status === "reserved" ? "reserved" : "unavailable"} ${selected === item.id ? "selected" : ""}`}
                                  disabled={!available}
                                  aria-pressed={selected === item.id}
                                  onClick={() => setSelected(item.id)}
                                >
                                  <Icon name="chair" className="tile-icon" />
                                  <strong className="tile-name">Table {item.table_number}</strong>
                                  <span className="tile-seats">{item.capacity} Seats</span>
                                  <span>
                                    {available
                                      ? "Available"
                                      : entry.status === "reserved"
                                        ? "Reserved"
                                        : "Unavailable"}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                      {!loading && !error && !availability.length && (
                        <EmptyState title="No tables are available for this time." />
                      )}
                      {!loading &&
                        !error &&
                        availability.length > 0 &&
                        guests &&
                        availability.every(
                          (entry) =>
                            tables.find((t) => t.id === entry.table_id)?.capacity < Number(guests),
                        ) && (
                          <EmptyState title={`No tables can seat ${guests} guests.`}>
                            Try selecting fewer guests or choose a different restaurant.
                          </EmptyState>
                        )}
                    </section>
                  )}
                </div>
                <aside className="right-column">
                  <div className="summary-card">
                    <h3>Reservation Summary</h3>
                    <div className="summary-body">
                      {table ? (
                        [
                          ["Restaurant", restaurant.name],
                          ["Date", date],
                          ["Time", timeLabel(slot?.start_time)],
                          ["Guests", `${guests || table.capacity} People`],
                          ["Table", `Table ${table.table_number} (${table.capacity} Seats)`],
                        ].map(([label, value]) => (
                          <div className="summary-row" key={label}>
                            <div>
                              <span className="summary-label">{label}</span>
                              <span className="summary-value">{value}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="summary-empty">
                          Select an available table to see your reservation summary.
                        </p>
                      )}
                    </div>
                    <button
                      className="btn-confirm"
                      disabled={!table || !slot || loading}
                      onClick={confirm}
                    >
                      Confirm Reservation
                    </button>
                    <p className="summary-hint">
                      {table
                        ? "Review your reservation before payment"
                        : "Please select a table to continue"}
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </DataState>
      </div>
    </DinerLayout>
  );
}
