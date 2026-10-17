import { useState, useContext } from "react";
import { DinerLayout, Hero, Icon } from "../components/Navigation.jsx";
import { DataState, EmptyState, ErrorMessage } from "../components/Feedback.jsx";
import ReservationCard from "../components/ReservationCard.jsx";
import { CancelDialog, ReviewDialog } from "../components/ReservationDialogs.jsx";
import { DinerContext } from "../context/DinerContext.js";

export default function ReservationsPage() {
  const { api, reservations, restaurants, slots } = useContext(DinerContext);
  const [filters, setFilters] = useState({ query: "", date: "", time: "" });
  const [cancel, setCancel] = useState(null);
  const [review, setReview] = useState(null);
  const [dineMessage, setDineMessage] = useState("");
  const [dineError, setDineError] = useState("");
  async function completeDine(reservation) {
    setDineMessage("");
    setDineError("");
    try {
      const result = await api.completeDine(reservation.id);
      setDineMessage(
        result.payout_release === "released"
          ? "Dining completed. The restaurant payout was released immediately."
          : `Dining completed. Payout status: ${result.payout_release || "pending"}.`,
      );
      return result;
    } catch (error) {
      setDineError(error.message);
      return null;
    }
  }
  const filtered = reservations.filter((reservation) => {
    const restaurant = restaurants.find((item) => item.id === reservation.restaurant_id);
    const slot = slots.find((item) => item.id === reservation.slot_id);
    return (
      (restaurant?.name || "").toLowerCase().includes(filters.query.toLowerCase()) &&
      (!filters.date || (slot?.slot_date || slot?.date) === filters.date) &&
      (!filters.time || slot?.start_time?.slice(0, 5) === filters.time)
    );
  });
  return (
    <DinerLayout header={false}>
      <Hero title="My Reservations" subtitle="View and manage all your restaurant reservations." />
      <div className="content-area">
        {dineMessage && (
          <div className="diner-success" role="status">
            {dineMessage}
          </div>
        )}
        <ErrorMessage message={dineError} />
        <div className="filters-card">
          <div className="search-row">
            <Icon name="magnifying-glass" className="search-icon" />
            <input
              aria-label="Search reservations"
              className="search-input"
              placeholder="Search reservations by restaurant name"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            />
          </div>
          <div className="filter-row">
            <div className="filter-select-wrap">
              <input
                type="date"
                aria-label="Filter by date"
                className="filter-select"
                value={filters.date}
                onChange={(event) => setFilters({ ...filters, date: event.target.value })}
              />
            </div>
            <div className="filter-select-wrap">
              <input
                type="time"
                aria-label="Filter by time"
                className="filter-select"
                value={filters.time}
                onChange={(event) => setFilters({ ...filters, time: event.target.value })}
              />
            </div>
            <button
              className="btn-clear"
              aria-label="Clear filters"
              onClick={() => setFilters({ query: "", date: "", time: "" })}
            >
              <Icon name="xmark" />
            </button>
          </div>
        </div>
        <DataState>
          {filtered.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onCancel={setCancel}
              onDineComplete={completeDine}
              onReview={setReview}
            />
          ))}
          {!filtered.length && (
            <EmptyState title="No reservations found">
              Try adjusting your search or filters.
            </EmptyState>
          )}
        </DataState>
      </div>
      {cancel && <CancelDialog reservation={cancel} onClose={() => setCancel(null)} />}
      {review && <ReviewDialog reservation={review} onClose={() => setReview(null)} />}
    </DinerLayout>
  );
}
