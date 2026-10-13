import { useState } from "react";
import { Icon, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import RestaurantCard from "../components/RestaurantCard.jsx";
import { matchesRestaurant } from "../components/RestaurantFilters.jsx";
import { useDiner } from "../hooks/useDiner.js";
import { image } from "../utils/images.js";

export default function SearchPage() {
  const { restaurants, params } = useDiner();
  const [query, setQuery] = useState(params.q || "");
  const results = restaurants.filter((restaurant) =>
    matchesRestaurant(restaurant, query),
  );
  return (
    <>
      <header className="search-header">
        <div className="header-container">
          <PageLink page="browse" className="logo-group">
            <img src={image("logo.png")} alt="" height="28" />
            <span className="logo-text">DineTime</span>
          </PageLink>
          <PageLink
            page="browse"
            className="back-btn"
            aria-label="Back to browse"
          >
            <Icon name="chevron-left" />
          </PageLink>
          <div className="search-bar-wrapper">
            <Icon name="magnifying-glass" className="search-icon" />
            <input
              autoFocus
              aria-label="Search restaurants"
              className="search-input"
              placeholder="Search for restaurants, cuisines..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </header>
      <main className="page-container">
        <DataState>
          <div className="results-info">
            {results.length} restaurants found{query && ` for “${query}”`}
          </div>
          <div className="restaurant-list">
            {results.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                compact
              />
            ))}
          </div>
          {!results.length && (
            <EmptyState title="No results matching">
              Try searching for a different name or cuisine.
            </EmptyState>
          )}
        </DataState>
      </main>
    </>
  );
}
