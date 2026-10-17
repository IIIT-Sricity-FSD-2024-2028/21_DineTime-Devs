import "./landing.css";
import logoImg from "../diner/utils/images/logo.png";
import heroImg from "./images/restaurant-interior-hero.jpg";
import featureMenusImg from "./images/feature-menus.jpg";
import featureReservationsImg from "./images/feature-reservations.jpg";
import featureDiningImg from "./images/feature-dining.jpg";
import staffManageImg from "./images/staff-manage-reservations.jpg";
import staffVerifyImg from "./images/staff-verify-guests.jpg";
import staffTrackImg from "./images/staff-track-tables.jpg";

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function LandingPage() {
  return (
    <div className="landing-wrapper">
      <nav>
        <div className="landing-logo">
          <img
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              objectFit: "contain",
              marginRight: 4,
            }}
            src={logoImg}
            alt="DineTime Logo"
          />
          DineTime
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              navigate("/login");
            }}
          >
            Login
          </a>
        </div>
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            navigate("/login");
          }}
          className="landing-btn-primary"
          style={{ padding: "0.6rem 1.5rem" }}
        >
          Get Started
        </a>
      </nav>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-content">
              <h1>
                Reserve Tables
                <br />
                Effortlessly
              </h1>
              <p>
                Discover top-tier restaurants, reserve tables instantly, and manage dining
                experiences with an elegant, smart dining platform.
              </p>
            </div>
            <div className="landing-hero-image-wrapper">
              <img src={heroImg} alt="Restaurant Interior" />
            </div>
          </div>
        </section>

        <section id="features" className="landing-container">
          <h2 className="landing-section-title">Why Choose DineTime</h2>
          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <h3>Real-Time Availability</h3>
              <p>
                View live table statuses instantly and secure your reservation without the wait.
              </p>
            </div>
            <div className="landing-feature-card">
              <h3>Seamless Management</h3>
              <p>
                Empower your restaurant to flawlessly handle bookings, seating charts, and time
                slots.
              </p>
            </div>
            <div className="landing-feature-card">
              <h3>Elevated Operations</h3>
              <p>
                Coordinate your staff and front-of-house operations to deliver a Michelin-level
                experience.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-container">
          <h2 className="landing-section-title">How It Works</h2>

          <div className="landing-flow-container">
            <div className="landing-flow-title">For Diners</div>
            <div className="landing-flow-steps">
              <div className="landing-step">
                <div className="landing-step-image-wrapper">
                  <img src={featureMenusImg} alt="Browse Menus" />
                </div>
                <h4>1. Browse Menus</h4>
              </div>
              <div className="landing-arrow">&rarr;</div>
              <div className="landing-step">
                <div className="landing-step-image-wrapper">
                  <img src={featureReservationsImg} alt="Reserve Table" />
                </div>
                <h4>2. Reserve Your Table</h4>
              </div>
              <div className="landing-arrow">&rarr;</div>
              <div className="landing-step">
                <div className="landing-step-image-wrapper">
                  <img src={featureDiningImg} alt="Enjoy Dining" />
                </div>
                <h4>3. Enjoy Dining</h4>
              </div>
            </div>
          </div>

          <div className="landing-flow-container">
            <div className="landing-flow-title">For Restaurants</div>
            <div className="landing-flow-steps">
              <div className="landing-step">
                <div className="landing-step-image-wrapper">
                  <img src={staffManageImg} alt="Manage Reservations" />
                </div>
                <h4>1. Manage Reservations</h4>
              </div>
              <div className="landing-arrow">&rarr;</div>
              <div className="landing-step">
                <div className="landing-step-image-wrapper">
                  <img src={staffVerifyImg} alt="Verify Guests" />
                </div>
                <h4>2. Verify Guest Check-Ins</h4>
              </div>
              <div className="landing-arrow">&rarr;</div>
              <div className="landing-step">
                <div className="landing-step-image-wrapper">
                  <img src={staffTrackImg} alt="Track Tables" />
                </div>
                <h4>3. Track Table Status</h4>
              </div>
            </div>
          </div>
        </section>

        <section id="portals" style={{ backgroundColor: "var(--landing-bg-light)" }}>
          <div className="landing-container">
            <h2 className="landing-section-title">Choose Your Portal</h2>
            <div className="landing-portal-grid">
              <div className="landing-portal-card">
                <div className="landing-portal-content">
                  <h3>Diner Portal</h3>
                  <p>
                    Discover exclusive restaurants, reserve tables, and manage your dining history.
                  </p>
                  <div className="landing-portal-btn-wrapper">
                    <a
                      href="/diner/register"
                      className="landing-btn-outline"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/diner/register");
                      }}
                    >
                      Register as Diner
                    </a>
                  </div>
                </div>
              </div>

              <div className="landing-portal-card">
                <div className="landing-portal-content">
                  <h3>Staff Portal</h3>
                  <p>Manage real-time reservations, update table statuses, and assist guests.</p>
                  <div className="landing-portal-btn-wrapper">
                    <a
                      href="/restaurant-staff/register"
                      className="landing-btn-outline"
                      onClick={(event) => {
                        event.preventDefault();
                        navigate("/restaurant-staff/register");
                      }}
                    >
                      Register as Staff
                    </a>
                  </div>
                </div>
              </div>

              <div className="landing-portal-card">
                <div className="landing-portal-content">
                  <h3>Manager Portal</h3>
                  <p>
                    Control your restaurant's digital presence, menus, staff access, and floor
                    plans.
                  </p>
                  <div className="landing-portal-btn-wrapper">
                    <a
                      href="/manager/register"
                      className="landing-btn-outline"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/manager/register");
                      }}
                    >
                      Register as Manager
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <a href="/" className="landing-footer-logo">
                <img
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    objectFit: "contain",
                    marginRight: 8,
                  }}
                  src={logoImg}
                  alt="DineTime Logo"
                />
                DineTime
              </a>
              <p className="landing-footer-tagline">
                Elevating restaurant experiences through intelligent technology.
              </p>
            </div>

            <div className="landing-footer-links-group">
              <div className="landing-footer-link-col">
                <h4>Contact Us</h4>
                <ul>
                  <li>
                    <a href="javascript:void(0)">Help &amp; Support</a>
                  </li>
                  <li>
                    <a href="javascript:void(0)">Partner With Us</a>
                  </li>
                </ul>
              </div>
              <div className="landing-footer-link-col">
                <h4>Legal</h4>
                <ul>
                  <li>
                    <a href="javascript:void(0)">Terms &amp; Conditions</a>
                  </li>
                  <li>
                    <a href="javascript:void(0)">Privacy Policy</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <p className="landing-footer-copyright">
              &copy; 2026 DineTime Limited. All rights reserved.
            </p>
            <div className="landing-social-links">
              <a href="javascript:void(0)" className="landing-social-icon" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a href="javascript:void(0)" className="landing-social-icon" aria-label="Instagram">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
