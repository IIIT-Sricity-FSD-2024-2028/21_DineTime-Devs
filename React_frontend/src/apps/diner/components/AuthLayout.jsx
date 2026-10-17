import { image } from "../utils/images.js";
import { Icon } from "./Navigation.jsx";

export default function AuthLayout({ register = false, locationStep = false, children }) {
  const features = register
    ? [
        "Discover top restaurants",
        "Real-time table availability",
        "Instant reservation confirmations",
      ]
    : ["Instant Reservations", "Real-time Table Availability", "Smart Dining Experience"];
  return (
    <div className="split-container">
      <section className="hero-side">
        {!register && (
          <a
            href="/"
            className="back-link"
            aria-label="Back to home"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          >
            <Icon name="chevron-left" />
          </a>
        )}
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="brand">
            <img className="auth-logo" src={image("logo.png")} alt="" />
            <span>DineTime</span>
          </div>
          <h1 className="hero-title">
            {locationStep
              ? "Find Restaurants Near You"
              : register
                ? "Join DineTime"
                : "Your Table Awaits"}
          </h1>
          <p className="hero-subtitle">
            {register
              ? "Create an account to reserve tables, skip waiting lines, and enjoy seamless dining experiences."
              : "Discover restaurants, reserve tables instantly, and enjoy a seamless dining experience."}
          </p>
          <ul className="feature-list">
            {features.map((feature) => (
              <li key={feature}>
                {register ? (
                  <div className="feature-icon">
                    <Icon name="circle-check" />
                  </div>
                ) : (
                  <Icon name="circle-check" />
                )}
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {register && (
            <div className="info-footer">
              <div className="decorative-line" />
              <span className="fine-dining">Fine dining, reimagined</span>
              <div className="decorative-line" />
            </div>
          )}
        </div>
      </section>
      <section className="form-side">
        {children}
        <footer className="footer">
          <nav className="footer-links">
            <span>Terms of Service</span>
            <span>Privacy Policy</span>
          </nav>
          <p>© 2026 DineTime. All rights reserved.</p>
        </footer>
      </section>
    </div>
  );
}
