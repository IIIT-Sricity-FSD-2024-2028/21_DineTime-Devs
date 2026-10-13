import { useState } from "react";

export const defaultFilters = {
  rating: 0,
  cuisines: [],
  time: "",
  distance: 10,
};

export function matchesRestaurant(restaurant, query, filters = defaultFilters) {
  const text =
    `${restaurant.name} ${restaurant.cuisine} ${restaurant.location}`.toLowerCase();
  return (
    text.includes(query.trim().toLowerCase()) &&
    restaurant.rating >= filters.rating &&
    (!filters.cuisines.length ||
      filters.cuisines.includes(restaurant.cuisine)) &&
    (!filters.time || restaurant.availableSlots.includes(filters.time)) &&
    (restaurant.distance == null || restaurant.distance <= filters.distance)
  );
}

export default function RestaurantFilters({
  value,
  cuisines,
  onApply,
  onClose,
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div
      className="filter-dropdown"
      role="dialog"
      aria-label="Restaurant filters"
    >
      <div className="filter-dropdown-header">
        <div>
          <h3>Filters</h3>
          <p>Refine restaurants based on your preferences</p>
        </div>
        <button
          type="button"
          className="filter-close-btn"
          onClick={onClose}
          aria-label="Close filters"
        >
          ×
        </button>
      </div>
      <div className="filter-dropdown-body">
        <div className="filter-section">
          <div className="flex-between">
            <h4>Distance</h4>
            <span className="value-display orange-text">
              {draft.distance} km
            </span>
          </div>
          <div className="slider-wrapper">
            <input
              aria-label="Maximum distance"
              type="range"
              className="orange-slider"
              min="1"
              max="10"
              value={draft.distance}
              onChange={(event) =>
                setDraft({ ...draft, distance: Number(event.target.value) })
              }
            />
            <div className="slider-labels">
              <span>1 km</span>
              <span>10 km</span>
            </div>
          </div>
          <p className="distance-note">
            Distance is available after setting your location.
          </p>
        </div>
        <div className="filter-section">
          <h4>Minimum Rating</h4>
          <div className="filter-options-list">
            {[4.5, 4, 3.5, 0].map((rating) => (
              <label key={rating}>
                <input
                  type="radio"
                  name="rating"
                  checked={draft.rating === rating}
                  onChange={() => setDraft({ ...draft, rating })}
                />
                <span>
                  {rating ? `${rating.toFixed(1)} and above` : "Any rating"}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="filter-section">
          <h4>Available Time</h4>
          <select
            aria-label="Available time"
            className="custom-select"
            value={draft.time}
            onChange={(event) =>
              setDraft({ ...draft, time: event.target.value })
            }
          >
            <option value="">Any Time</option>
            {["18:00", "20:00", "22:00"].map((time, index) => (
              <option key={time} value={time}>
                {6 + index * 2}:00 PM
              </option>
            ))}
          </select>
        </div>
        <div className="filter-section">
          <h4>Cuisine Type</h4>
          <div className="filter-options-list">
            {cuisines.map((cuisine) => (
              <label key={cuisine}>
                <input
                  type="checkbox"
                  checked={draft.cuisines.includes(cuisine)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      cuisines: event.target.checked
                        ? [...draft.cuisines, cuisine]
                        : draft.cuisines.filter((item) => item !== cuisine),
                    })
                  }
                />
                <span>{cuisine}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="filter-dropdown-footer">
        <button
          type="button"
          className="btn btn-outline-orange"
          onClick={() => {
            setDraft(defaultFilters);
            onApply(defaultFilters);
          }}
        >
          Reset Filters
        </button>
        <button
          type="button"
          className="btn btn-primary-orange"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
