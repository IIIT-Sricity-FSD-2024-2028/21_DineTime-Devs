import { useContext, useState } from "react";
import { Icon, PageLink } from "./Navigation.jsx";
import { DinerContext } from "../context/DinerContext.js";
import { statusLabel, timeLabel } from "../utils/format.js";
import ReservationPayment from "./ReservationPayment.jsx";

export function canModify(reservation, slot) {
  return (
    reservation?.reservation_status === "reserved" &&
    (reservation.modification_history?.length || 0) < 2 &&
    Boolean(slot) &&
    new Date(`${slot.slot_date || slot.date}T${slot.start_time}`).getTime() > Date.now()
  );
}

export function StatusBadge({ status }) {
  const style = ["reserved", "checked_in"].includes(status)
    ? "confirmed"
    : status === "completed"
      ? "completed"
      : "cancelled";
  return <span className={`badge badge-${style}`}>{statusLabel(status)}</span>;
}

export function canCancel(reservation, restaurant, slot) {
  if (reservation.reservation_status !== "reserved" || !slot) return false;
  const start = new Date(`${slot.slot_date || slot.date}T${slot.start_time}`);
  return Date.now() < start.getTime() - (restaurant?.cancellation_cutoff_minutes ?? 120) * 60000;
}

export default function ReservationCard({
  reservation,
  onCancel,
  onDineComplete,
  onReview,
  compact = false,
}) {
  const [dineCompletedLocally, setDineCompletedLocally] = useState(false);
  const { restaurants, slots, reviews, tables } = useContext(DinerContext);
  const dineCompleted = Boolean(reservation.diner_completed_at || dineCompletedLocally);
  async function completeDine() {
    const result = await onDineComplete(reservation);
    if (result) setDineCompletedLocally(true);
  }
  const restaurant = restaurants.find((item) => item.id === reservation.restaurant_id);
  const slot = slots.find((item) => item.id === reservation.slot_id);
  const reservationTableIds = reservation.table_ids?.length
    ? reservation.table_ids
    : [reservation.table_id].filter(Boolean);
  const bookedTables = reservationTableIds
    .map((id) => tables.find((item) => item.id === id))
    .filter(Boolean);
  const tableLabel = bookedTables.length
    ? bookedTables.map((item) => `Table ${item.table_number} (${item.capacity} seats)`).join(", ")
    : "Table details unavailable";
  const reviewed = reviews.some((review) => review.reservation_id === reservation.id);
  if (compact)
    return (
      <article className="up-card">
        <img src={restaurant?.image} className="up-thumb" alt={restaurant?.name || "Restaurant"} />
        <div className="up-details">
          <div className="up-title">{restaurant?.name}</div>
          <div className="up-meta">
            <Icon name="calendar" /> {slot?.slot_date || slot?.date}
          </div>
          <div className="up-meta">
            <Icon name="clock" /> {timeLabel(slot?.start_time)}
          </div>
          <div className="up-meta">
            <Icon name="people-group" /> {reservation.guest_count} Guests
          </div>
          <div className="up-meta">
            <Icon name="chair" /> {tableLabel}
          </div>
          <div className="up-meta badge-col">
            <span className="badge-success">{statusLabel(reservation.reservation_status)}</span>
          </div>
          <ReservationPayment reservation={reservation} compact />
        </div>
        <div className="up-actions">
          {canModify(reservation, slot) && (
            <PageLink page="modify" params={{ id: reservation.id }} className="btn-blue">
              Modify Reservation
            </PageLink>
          )}
          {reservation.reservation_status === "reserved" &&
            (reservation.modification_history?.length || 0) >= 2 && (
              <span className="res-cancel-note">Reschedule limit reached (2 of 2).</span>
            )}
          <PageLink page="details" params={{ id: reservation.id }} className="btn-blue">
            <Icon name="eye" /> View Details
          </PageLink>
          {canCancel(reservation, restaurant, slot) && (
            <button className="btn-red" onClick={() => onCancel(reservation)}>
              <Icon name="xmark" /> Cancel
            </button>
          )}
          {["checked_in", "completed"].includes(reservation.reservation_status) &&
            !dineCompleted && (
              <button className="btn-dine-complete" onClick={completeDine}>
                Dine Complete
              </button>
            )}
        </div>
      </article>
    );
  return (
    <article className="res-card">
      <img src={restaurant?.image} alt={restaurant?.name || "Restaurant"} className="res-img" />
      <div className="res-body">
        <div className="res-header">
          <span className="res-name">{restaurant?.name || "Restaurant"}</span>
          <StatusBadge status={reservation.reservation_status} />
        </div>
        <div className="res-info-grid">
          <div className="res-info-item">
            <Icon name="calendar" />
            <span>{slot?.slot_date || slot?.date}</span>
          </div>
          <div className="res-info-item">
            <Icon name="clock" />
            <span>{timeLabel(slot?.start_time)}</span>
          </div>
          <div className="res-info-item">
            <Icon name="people-group" />
            <span>{reservation.guest_count} Guests</span>
          </div>
          <div className="res-info-item">
            <Icon name="chair" />
            <span>{tableLabel}</span>
          </div>
          <div className="res-info-item">
            <Icon name="location-dot" />
            <span>{restaurant?.location}</span>
          </div>
        </div>
        <ReservationPayment reservation={reservation} compact />
        <div className="res-actions">
          {canModify(reservation, slot) && (
            <PageLink page="modify" params={{ id: reservation.id }} className="btn-view-details">
              Modify Reservation
            </PageLink>
          )}
          {reservation.reservation_status === "reserved" &&
            (reservation.modification_history?.length || 0) >= 2 && (
              <span className="res-cancel-note">Reschedule limit reached (2 of 2).</span>
            )}
          <PageLink
            page="support"
            params={{ reservation: reservation.id }}
            className="btn-view-details"
          >
            Get Help
          </PageLink>
          <PageLink page="details" params={{ id: reservation.id }} className="btn-view-details">
            <Icon name="eye" /> View Details
          </PageLink>
          {reservation.reservation_status === "completed" && dineCompleted && (
            <button className="btn-rate" onClick={() => onReview(reservation)}>
              <Icon name="star" />
              {reviewed ? "View Rating" : "Rate Experience"}
            </button>
          )}
          {canCancel(reservation, restaurant, slot) && (
            <button className="btn-cancel" onClick={() => onCancel(reservation)}>
              Cancel
            </button>
          )}
          {["checked_in", "completed"].includes(reservation.reservation_status) &&
            !dineCompleted && (
              <button className="btn-dine-complete" onClick={completeDine}>
                Dine Complete
              </button>
            )}
        </div>
        {reservation.reservation_status === "reserved" &&
          !canCancel(reservation, restaurant, slot) && (
            <div className="res-cancel-note">
              Cancellation window has closed for this reservation.
            </div>
          )}
      </div>
    </article>
  );
}
