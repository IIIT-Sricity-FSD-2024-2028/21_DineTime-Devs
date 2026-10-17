import { Icon, PageLink } from "./Navigation.jsx";
import { image } from "../utils/images.js";
import { timeLabel } from "../utils/format.js";

export default function RestaurantCard({ restaurant, compact = false }) {
  if (compact)
    return (
      <PageLink page="restaurant" params={{ id: restaurant.id }} className="result-bar">
        <img src={restaurant.image} alt={restaurant.name} className="result-img" />
        <div className="result-info">
          <div className="result-name">{restaurant.name}</div>
          <div className="result-cuisine">{restaurant.cuisine}</div>
        </div>
        <div className="result-meta">
          <div className="result-rating">
            <Icon name="star" /> {restaurant.total_reviews > 0 ? restaurant.rating : "New"}
          </div>
          <div className="result-distance">{restaurant.city}</div>
        </div>
      </PageLink>
    );
  return (
    <article className="card">
      <PageLink page="restaurant" params={{ id: restaurant.id }} className="card-img-wrapper">
        <img src={restaurant.image} alt={restaurant.name} loading="lazy" />
      </PageLink>
      <div className="card-content">
        <h3 className="card-title">
          <PageLink page="restaurant" params={{ id: restaurant.id }}>
            {restaurant.name}
          </PageLink>
        </h3>
        <p className="card-cuisine">{restaurant.cuisine}</p>
        <div className="card-meta-row">
          <div className="rating-badge">
            <img src={image("icon-star.png")} alt="Rating" width="16" height="16" />
            <span>{restaurant.total_reviews > 0 ? restaurant.rating : "New"}</span>
          </div>
          <div className="distance-badge">
            <img src={image("icon-location.png")} alt="Location" width="14" height="14" />
            <span>{restaurant.city || "Location unavailable"}</span>
          </div>
        </div>
        <div className="slots-section">
          <p className="slots-label">Available Slots</p>
          <div className="time-slots-container">
            {restaurant.availableSlots.length ? (
              restaurant.availableSlots.map((time) => (
                <span key={time} className="time-pill">
                  {timeLabel(time)}
                </span>
              ))
            ) : (
              <span>No slots available</span>
            )}
          </div>
        </div>
        <PageLink page="restaurant" params={{ id: restaurant.id }} className="btn-reserve">
          Reserve Table
        </PageLink>
      </div>
    </article>
  );
}
