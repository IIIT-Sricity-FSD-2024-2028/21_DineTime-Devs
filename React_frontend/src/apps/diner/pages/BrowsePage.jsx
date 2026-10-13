import { useState } from "react";
import { DinerLayout, Icon } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import RestaurantCard from "../components/RestaurantCard.jsx";
import RestaurantFilters, {
  defaultFilters,
  matchesRestaurant,
} from "../components/RestaurantFilters.jsx";
import { useDiner } from "../hooks/useDiner.js";
import { image } from "../utils/images.js";

export default function BrowsePage() {
  const { restaurants } = useDiner();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const cuisines = [...new Set(restaurants.map((item) => item.cuisine))];
  const filtered = restaurants.filter((restaurant) =>
    matchesRestaurant(restaurant, query, filters),
  );
  const searching =
    query ||
    filters.rating ||
    filters.cuisines.length ||
    filters.time ||
    filters.distance < 10;
  const section = (title, items) => (
    <section className="section">
      <h2>{title}</h2>
      <div className="restaurant-horizontal-grid">
        {items.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </div>
    </section>
  );
  return (
    <DinerLayout
      searchProps={{
        value: query,
        onChange: setQuery,
        children: (
          <button
            type="button"
            className="filter-icon-btn"
            aria-label="Filters"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Icon name="sliders" />
          </button>
        ),
      }}
    >
      {filterOpen && (
        <RestaurantFilters
          value={filters}
          cuisines={cuisines}
          onApply={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
      <div className="page-body container">
        <DataState>
          <section className="section cuisine-section">
            <h2>Browse by Cuisine</h2>
            <div className="cuisine-scroll">
              {cuisines.map((cuisine) => (
                <button
                  key={cuisine}
                  className={`cuisine-card ${filters.cuisines.includes(cuisine) ? "active-cuisine" : ""}`}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      cuisines: filters.cuisines.includes(cuisine)
                        ? filters.cuisines.filter((item) => item !== cuisine)
                        : [...filters.cuisines, cuisine],
                    })
                  }
                >
                  <img src={image(`${cuisine.toLowerCase()}.jpg`)} alt="" />
                  <span>{cuisine}</span>
                </button>
              ))}
            </div>
          </section>
          {searching ? (
            section(`${filtered.length} Restaurants Found`, filtered)
          ) : (
            <>
              {section(
                "Top Rated Restaurants",
                [...restaurants].sort((a, b) => b.rating - a.rating),
              )}
              {section("Popular Near You", restaurants)}
            </>
          )}
          {!filtered.length && (
            <EmptyState title="No restaurants match">
              Try adjusting your search.
            </EmptyState>
          )}
        </DataState>
      </div>
    </DinerLayout>
  );
}
