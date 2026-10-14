import { Icon } from "./Navigation.jsx";
import { money, timeLabel } from "../utils/format.js";

export function RestaurantSummary({ restaurant }) {
  return (
    <div className="restaurant-row">
      <img src={restaurant.image} className="rest-img" alt={restaurant.name} />
      <div className="rest-info">
        <span className="rest-name">{restaurant.name}</span>
        <span className="rest-cuisine">{restaurant.cuisine}</span>
        <div className="rest-meta">
          <span className="rest-rating">
            <Icon name="star" /> {restaurant.rating}
          </span>
          <span className="rest-distance">{restaurant.location}</span>
        </div>
      </div>
    </div>
  );
}

export function BookingInformation({
  booking,
  table,
  className = "info-grid",
}) {
  const rows = [
    ["calendar", "Date", booking.date],
    ["clock", "Time", timeLabel(booking.time)],
    ["user-group", "Guests", `${booking.guests} Guests`],
    ["chair", "Table", table ? `Table ${table.table_number}` : booking.tableId],
  ];
  return (
    <div className={className}>
      {rows.map(([icon, label, value]) => (
        <div className="info-tile" key={label}>
          <Icon name={icon} className="info-tile-icon" />
          <div className="info-tile-content">
            <span className="info-tile-label">{label}</span>
            <span className="info-tile-value">{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function reservationCost(restaurant, guests) {
  const deposit =
    Number(restaurant?.reservation_fee_per_guest ?? 30) * Number(guests || 0);
  return { deposit, service: 20, total: deposit + 20 };
}

export function CostSummary({ restaurant, booking }) {
  const cost = reservationCost(restaurant, booking.guests);
  return (
    <div className="cost-card">
      <h2 className="cost-title">Reservation Cost Summary</h2>
      <div className="cost-lines">
        <div className="cost-line">
          <span className="cost-line-label">
            Reservation Deposit ({booking.guests} Guests)
          </span>
          <span className="cost-line-value">{money(cost.deposit)}</span>
        </div>
        <div className="cost-line">
          <span className="cost-line-label">Platform Service Fee</span>
          <span className="cost-line-value">{money(cost.service)}</span>
        </div>
        <div className="cost-line-note">
          Your deposit is adjustable against your final bill at the restaurant.
        </div>
      </div>
      <div className="cost-divider" />
      <div className="cost-total-row">
        <span className="cost-total-label">Total Amount</span>
        <span className="cost-total-value">{money(cost.total)}</span>
      </div>
      <SecureBadge />
    </div>
  );
}

export function SecureBadge() {
  return (
    <div className="secure-badge">
      <Icon name="lock" className="secure-icon" />
      <span>Secure payment powered by encrypted transactions</span>
    </div>
  );
}
