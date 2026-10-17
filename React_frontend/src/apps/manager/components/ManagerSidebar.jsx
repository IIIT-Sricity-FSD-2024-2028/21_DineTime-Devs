import { useContext } from "react";
import { ManagerContext } from "../context/ManagerContext.jsx";

const links = [
  ["profile", "ph-user", "Profile"],
  ["reservations", "ph-calendar-blank", "Reservations"],
  ["menu", "ph-fork-knife", "Menu Management"],
  ["time-slots", "ph-clock", "Time Slot Management"],
  [
    "tables",
    "ph-squares-four",
    <>
      Table and Capacity
      <br />
      Management
    </>,
  ],
  ["revenue", "ph-currency-circle-dollar", "Revenue"],
  ["reviews", "ph-star", "Customer Reviews"],
  ["issues", "ph-headset", "Raise an Issue"],
];

export default function ManagerSidebar() {
  const { navigate, currentPage } = useContext(ManagerContext);

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <img src="/assets/logo.png" alt="DineTime Logo" />
        <div className="logo-text">
          <h1>DineTime</h1>
          <span>Manager Portal</span>
        </div>
      </div>
      <nav className="main-nav">
        <ul>
          {links.map(([page, icon, label]) => (
            <li key={page}>
              <a
                href="#"
                className={currentPage === page ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(page);
                }}
              >
                <i className={`ph ${icon}`} />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
