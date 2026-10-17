import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";

export function AdminLayout({ logoIcon, label, navItems, children }) {
  const { logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(navItems[0]?.id || "dashboard");

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <i className={`fa-solid ${logoIcon}`} style={{ marginRight: 8 }} /> DineTime
          <span
            style={{
              fontSize: "0.62rem",
              color: "#A3B5A4",
              display: "block",
              letterSpacing: 1,
              marginTop: 4,
            }}
          >
            {label}
          </span>
        </div>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            <i className={`fa-solid ${item.icon}`} /> {item.label}
          </div>
        ))}
        <div className="nav-item" style={{ marginTop: "auto", color: "#fca5a5" }} onClick={logout}>
          <i className="fa-solid fa-right-from-bracket" /> Sign Out
        </div>
      </aside>
      <div className="main-wrapper">
        <main className="main-content">{children(activeTab)}</main>
      </div>
    </div>
  );
}
