import { useContext, useState } from "react";
import { Icon, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import { DinerContext } from "../context/DinerContext.js";
import { image } from "../utils/images.js";
import { money, timeLabel } from "../utils/format.js";

export default function MenuPage() {
  const { params, restaurants, menu, reservations, slots, tables } = useContext(DinerContext);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const restaurant = restaurants.find((item) => item.id === params.id);
  const reservation = reservations.find(
    (item) => item.id === params.reservation && item.restaurant_id === params.id,
  );
  const slot = slots.find((item) => item.id === reservation?.slot_id);
  const table = tables.find((item) => item.id === reservation?.table_id);
  const dishes = menu.filter((item) => item.restaurant_id === params.id);
  const filtered = dishes.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      item.item_name.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = ["All", ...new Set(dishes.map((item) => item.category))];

  return (
    <main className="main-content">
      <header className="menu-header">
        <div className="header-container">
          <div className="header-left">
            <PageLink
              page={reservation ? "details" : "restaurant"}
              params={{ id: reservation?.id || params.id }}
              className="btn-icon-back"
              aria-label="Back"
            >
              <Icon name="chevron-left" />
            </PageLink>
            <PageLink page="browse" className="header-logo">
              <img src={image("logo.png")} alt="" height="32" className="logo-img" />
              <h2>DineTime</h2>
            </PageLink>
          </div>
          <div className="header-center">
            <div className="header-search">
              <Icon name="magnifying-glass" className="search-icon" />
              <input
                aria-label="Search dishes"
                placeholder="Search dishes or menu items"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <PageLink page="profile" className="header-right" aria-label="My profile">
            <Icon name="user" />
          </PageLink>
        </div>
      </header>
      <DataState>
        {!restaurant ? (
          <EmptyState title="Restaurant not found" />
        ) : (
          <>
            <div className="reservation-info-bar">
              <div className="info-group">
                <div className="info-res-header">
                  <img src={restaurant.image} alt={restaurant.name} className="info-res-thumb" />
                  <div className="info-res-content">
                    <h3>{restaurant.name}</h3>
                    <span className="info-sub">
                      {table
                        ? tables
                            .filter((item) =>
                              (reservation.table_ids || [reservation.table_id]).includes(item.id),
                            )
                            .map((item) => `Table ${item.table_number}`)
                            .join(", ")
                        : "Explore our menu"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="info-stats">
                {reservation && (
                  <>
                    <div className="stat">
                      <Icon name="clock" />
                      {timeLabel(slot?.start_time)}
                    </div>
                    <div className="stat">
                      <Icon name="user-group" />
                      {reservation.guest_count} Guests
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="menu-layout">
              <div className="menu-left">
                <div className="filters-container">
                  <div className="category-filters">
                    {categories.map((item) => (
                      <button
                        key={item}
                        className={`btn-category ${category === item ? "active" : ""}`}
                        onClick={() => setCategory(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="menu-grid">
                  {filtered.map((item, index) =>
                    index % 4 === 0 ? (
                      <div className="menu-special-tile" key={item.id}>
                        <span className="special-badge">Chef's Special</span>
                        <img src={item.image} alt={item.item_name} className="special-img" />
                        <div className="special-info">
                          <div className="special-name-row">
                            <h3 className="bar-name">{item.item_name}</h3>
                            <span className="special-price">{money(item.price)}</span>
                          </div>
                          {item.availability === false && (
                            <span className="menu-item-status">Unavailable</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="menu-bar-item" key={item.id}>
                        <img src={item.image} alt={item.item_name} className="bar-img" />
                        <div className="bar-info">
                          <h3 className="bar-name">{item.item_name}</h3>
                          <span className="bar-price">{money(item.price)}</span>
                        </div>
                        {item.availability === false && (
                          <span className="menu-item-status">Unavailable</span>
                        )}
                      </div>
                    ),
                  )}
                </div>
                {!filtered.length && <EmptyState title="No dishes found" />}
              </div>
            </div>
          </>
        )}
      </DataState>
    </main>
  );
}
