import { indiaToday } from "../../../app/indiaTime.js";
import { createAction } from "../../../app/actions.js";
import { useState, useContext } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";

function todayIso() {
  return indiaToday();
}

const stats = [
  ["total", "Today's Total", "ph-folder", "stat-icon-total"],
  ["confirmed", "Confirmed", "ph-check", "stat-icon-confirmed"],
  ["pending", "Pending", "ph-clock", "stat-icon-pending-res"],
  ["cancelled", "Cancelled", "ph-x-circle", "stat-icon-cancelled"],
  ["noshow", "No-show", "ph-x", "stat-icon-noshow"],
];

export default function ReservationsPage() {
  const { data, storage, refresh, navigate } = useContext(ManagerContext);
  const { showToast } = useContext(ToastContext);
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState("");
  const [guests, setGuests] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const reservations = data?.reservations || [];
  const todayReservations = reservations.filter((reservation) => reservation.date === todayIso());
  const counts = {
    total: todayReservations.length,
    confirmed: todayReservations.filter((reservation) => reservation.status === "Confirmed").length,
    pending: todayReservations.filter((reservation) => reservation.status === "Pending").length,
    cancelled: todayReservations.filter((reservation) => reservation.status === "Cancelled").length,
    noshow: todayReservations.filter((reservation) => reservation.status === "No-show").length,
  };
  const filtered = reservations.filter((reservation) => {
    const needle = query.toLowerCase();
    const matchesQuery =
      !needle ||
      [reservation.name, reservation.email, reservation.phone].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(needle),
      );
    const matchesDate = !date || reservation.date === date;
    const matchesStatus = !status || reservation.status === status;
    const count = Number(reservation.guests || 0);
    const matchesGuests =
      !guests ||
      (guests === "2" && count === 2) ||
      (guests === "4" && count === 4) ||
      (guests === "6+" && count >= 6);
    return matchesQuery && matchesDate && matchesStatus && matchesGuests;
  });

  const clearFilters = () => {
    setQuery("");
    setDate(todayIso());
    setStatus("");
    setGuests("");
    showToast("Filters cleared.");
  };

  const markComplete = (reservation) =>
    run(async () => {
      await storage.updateReservationStatus(reservation.id, "Complete");
      refresh();
      showToast(`Reservation #${reservation.id} marked as complete.`);
    });

  return (
    <ManagerLayout
      title="Reservations"
      description="Manage and monitor all restaurant reservations"
      pageClassName="manager-page-restaurant-header"
    >
      <div className="stats-grid">
        {stats.map(([key, label, icon, iconClass]) => (
          <div className="stat-card" key={key}>
            <div className={`stat-icon ${iconClass}`}>
              <i className={`ph ${icon}`} />
            </div>
            <span className="stat-label">{label}</span>
            <span className="stat-value">{counts[key]}</span>
          </div>
        ))}
      </div>
      <section className="card filter-container">
        <div className="search-bar">
          <i className="ph ph-magnifying-glass" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for name, email, and phone..."
          />
        </div>
        <div className="filter-dropdowns">
          <div className="filter-group-premium">
            <div className="premium-date-wrapper">
              <input
                type="date"
                aria-label="Reservation date"
                value={date}
                onInput={(event) => setDate(event.target.value)}
              />
              <i className="ph ph-calendar-blank" />
            </div>
          </div>
          <div className="dropdown-wrapper">
            <i className="ph ph-funnel" />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All Statuses</option>
              <option>Confirmed</option>
              <option>Pending</option>
              <option>Cancelled</option>
              <option>No-show</option>
              <option>Complete</option>
            </select>
          </div>
          <div className="dropdown-wrapper">
            <i className="ph ph-users" />
            <select value={guests} onChange={(event) => setGuests(event.target.value)}>
              <option value="">Any Size</option>
              <option value="2">2 Guests</option>
              <option value="4">4 Guests</option>
              <option value="6+">6+ Guests</option>
            </select>
          </div>
          <button className="btn btn-small clear-filters-btn" type="button" onClick={clearFilters}>
            <i className="ph ph-x" /> Clear Filters
          </button>
        </div>
      </section>
      <div className="reservations-list">
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await storage.refreshFromBackend();
              refresh();
            })
          }
        >
          Refresh Reservations
        </button>
        {error && (
          <p role="alert" className="phase1-error">
            {error}
          </p>
        )}
        {filtered.length ? (
          filtered.map((reservation) => (
            <article className="res-card card" key={reservation.id}>
              <button
                className="res-summary"
                type="button"
                onClick={() => setExpanded(expanded === reservation.id ? null : reservation.id)}
              >
                <div className="res-primary">
                  <h4>
                    {reservation.name}{" "}
                    <span
                      className={`res-badge res-badge-${reservation.status.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {reservation.status}
                    </span>
                  </h4>
                  <div className="res-meta">
                    <span>
                      <i className="ph ph-calendar-blank" /> {reservation.date} | {reservation.time}
                    </span>
                    <span>
                      <i className="ph ph-users" /> {reservation.guests} guests
                    </span>
                    <span>
                      <i className="ph ph-armchair" /> {reservation.table}
                    </span>
                    {reservation.diner_paid_excluding_platform_fee !== null &&
                      reservation.diner_paid_excluding_platform_fee !== undefined && (
                        <span className="res-paid-amount">
                          <i className="ph ph-currency-inr" /> Paid ₹
                          {reservation.diner_paid_excluding_platform_fee.toLocaleString("en-IN")}
                        </span>
                      )}
                  </div>
                </div>
                <span className="toggle-text">
                  View Details{" "}
                  <i
                    className={`ph ${expanded === reservation.id ? "ph-caret-up" : "ph-caret-down"}`}
                  />
                </span>
              </button>
              {expanded === reservation.id && (
                <div className="res-details">
                  <div className="details-grid">
                    <div className="detail-item-small">
                      <span className="detail-label">Email Address</span>
                      <span className="detail-value">{reservation.email}</span>
                    </div>
                    <div className="detail-item-small">
                      <span className="detail-label">Phone Number</span>
                      <span className="detail-value">{reservation.phone}</span>
                    </div>
                  </div>

                  <div className="res-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() =>
                        navigate("issues", {
                          reservation: reservation.id,
                          issue: "customer_dispute_no_show",
                        })
                      }
                    >
                      Get Help
                    </button>
                    {reservation.status === "Complete" ? (
                      <button
                        className="btn btn-small"
                        type="button"
                        disabled
                        style={{
                          backgroundColor: "#E8F5E9",
                          color: "#2E7D32",
                          border: "1px solid #A5D6A7",
                          cursor: "default",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 600,
                        }}
                      >
                        <i className="ph ph-check-circle" style={{ fontSize: "1rem" }} />
                        Marked Complete
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary-green btn-small"
                        type="button"
                        disabled={busy || reservation.reservation_status !== "checked_in"}
                        title={
                          reservation.reservation_status === "reserved"
                            ? "Restaurant staff must check in the diner before completion."
                            : undefined
                        }
                        onClick={() => markComplete(reservation)}
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state-panel reservations-empty">
            <i className="ph ph-calendar-blank" />
            <p>No reservations found matching your criteria.</p>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
