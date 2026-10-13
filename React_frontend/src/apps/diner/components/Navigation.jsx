import { useState } from "react";
import { useDiner } from "../hooks/useDiner.js";
import { image } from "../utils/images.js";

export function Icon({ name, className = "" }) {
  return (
    <i aria-hidden="true" className={`fa-solid fa-${name} ${className}`} />
  );
}

export function PageLink({ page, params, children, ...props }) {
  const { navigate } = useDiner();
  return (
    <a
      {...props}
      href={`/diner/${page}${params ? `?${new URLSearchParams(params)}` : ""}`}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        navigate(page, params);
      }}
    >
      {children}
    </a>
  );
}

export function Sidebar() {
  const { currentPage } = useDiner();
  const links = [
    ["profile", "user", "Profile"],
    ["reservations", "calendar-check", "My Reservations"],
    ["browse", "utensils", "Browse Restaurants"],
    ["settings", "gear", "Settings"],
    ["support", "headset", "Customer Support"],
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={image("logo.png")} alt="DineTime Logo" />
        <h2>DineTime</h2>
      </div>
      <nav className="sidebar-nav" aria-label="Diner navigation">
        {links.map(([page, icon, label]) => (
          <PageLink
            key={page}
            page={page}
            aria-current={currentPage === page ? "page" : undefined}
            className={`nav-item ${currentPage === page ? "active" : ""}`}
          >
            <Icon name={icon} />
            {label}
          </PageLink>
        ))}
      </nav>
    </aside>
  );
}

export function SearchHeader({ value, onChange, children }) {
  const { navigate } = useDiner();
  const [query, setQuery] = useState("");
  return (
    <header className="top-header">
      <form
        className="search-container"
        onSubmit={(event) => {
          event.preventDefault();
          navigate("search", { q: value ?? query });
        }}
      >
        <img
          src={image("icon-search.png")}
          className="search-icon"
          alt=""
          width="25"
          height="25"
        />
        <input
          aria-label="Search restaurants"
          className="search-input"
          placeholder="Search restaurants, cuisines, or locations"
          value={value ?? query}
          onChange={(event) =>
            onChange
              ? onChange(event.target.value)
              : setQuery(event.target.value)
          }
        />
        {children}
      </form>
      <PageLink page="profile" aria-label="My profile">
        <img src={image("icon-profile.png")} alt="" width="28" height="28" />
      </PageLink>
    </header>
  );
}

export function StackedHeader() {
  return (
    <header className="stacked-header">
      <PageLink page="browse" className="stacked-brand">
        <img src={image("logo.png")} height="28" alt="" />
        <strong>DineTime</strong>
      </PageLink>
      <PageLink page="profile" aria-label="My profile">
        <Icon name="user" />
      </PageLink>
    </header>
  );
}

export function Hero({ title, subtitle, settings = false, children }) {
  return (
    <div className={settings ? "settings-hero" : "hero-banner"}>
      <div className="hero-overlay" />
      <div className={settings ? "hero-content" : "hero-text"}>
        <h1 className="hero-title">{title}</h1>
        <p className="hero-sub">{subtitle}</p>
      </div>
      {children || (
        <div className="hero-user">
          <PageLink page="profile" aria-label="My profile">
            <Icon name="user" className="hero-user-icon" />
          </PageLink>
        </div>
      )}
    </div>
  );
}

export function DinerLayout({ children, header = true, searchProps }) {
  return (
    <>
      <Sidebar />
      <main className="main-content">
        {header && <SearchHeader {...searchProps} />}
        {children}
      </main>
    </>
  );
}
