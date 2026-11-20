import { useState } from "react";
import { useAuth } from "../../store/hooks/useAuth.js";
import heroImage from "../landing/images/restaurant-interior-hero.jpg";
import "./unified-auth.css";

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function goToRole(role) {
  const destinations = {
    diner: "/diner/browse",
    manager: "/manager/profile",
    staff: "/restaurant-staff/check-in",
    superAdmin: "/super-admin/super-dashboard",
  };
  navigate(destinations[role]);
}

export default function UnifiedAuthPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      if (user.resumeBooking) navigate("/diner/payment_making");
      else if (user.team) navigate(`/sub-admin/${user.team}-dashboard`);
      else goToRole(user.role === "super_user" ? "superAdmin" : user.role);
    } catch (cause) {
      setError(cause.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="unified-auth-page">
      <section
        className="unified-auth-brand"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(15, 31, 27, .94), rgba(31, 49, 39, .76)), url("${heroImage}")`,
        }}
      >
        <a
          href="/"
          className="unified-auth-logo"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <img src="/assets/logo.png" alt="" />
          <span>DineTime</span>
        </a>
        <div className="unified-auth-brand-copy">
          <span className="unified-auth-eyebrow">A better table starts here</span>
          <h1>
            Good food.
            <br />
            Great company.
          </h1>
          <p>Sign in once to continue to your DineTime account.</p>
        </div>
        <div className="unified-auth-brand-footer">
          Discover restaurants, reserve tables, and make every meal count.
        </div>
      </section>

      <section className="unified-auth-panel">
        <button
          className="unified-auth-back"
          type="button"
          aria-label="Back to landing page"
          title="Back to landing page"
          onClick={() => navigate("/")}
        >
          <i className="ph ph-arrow-left" aria-hidden="true" />
        </button>
        <form className="unified-auth-card" onSubmit={submit}>
          <div className="unified-auth-card-mark">
            <i className="ph ph-fork-knife" />
          </div>
          <span className="unified-auth-eyebrow">Welcome back</span>
          <h2>Sign in to DineTime</h2>
          <p className="unified-auth-intro">
            Use the email and password for your DineTime account. We’ll send you to the right
            workspace.
          </p>

          <label className="unified-auth-field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="unified-auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="unified-auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="unified-auth-submit" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <i className="ph ph-arrow-right" />
          </button>
          <div className="unified-auth-register-prompt">
            New to DineTime?{" "}
            <button type="button" onClick={() => setRegisterOpen(true)}>
              Create an account
            </button>
          </div>
        </form>
        <footer className="unified-auth-copyright">© 2026 DineTime. All rights reserved.</footer>
      </section>

      {registerOpen && (
        <div
          className="unified-auth-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRegisterOpen(false);
          }}
        >
          <section
            className="unified-auth-register-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-choice-title"
          >
            <button
              className="unified-auth-close"
              type="button"
              aria-label="Close"
              onClick={() => setRegisterOpen(false)}
            >
              <i className="ph ph-x" />
            </button>
            <span className="unified-auth-eyebrow">Join DineTime</span>
            <h2 id="register-choice-title">Choose an account type</h2>
            <p>Choose how you want to use DineTime.</p>
            <button
              className="unified-auth-role"
              type="button"
              onClick={() => navigate("/diner/register")}
            >
              <span className="unified-auth-role-icon">
                <i className="ph ph-user" />
              </span>
              <span>
                <b>Register as a diner</b>
                <small>Discover restaurants and reserve a table</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button
              className="unified-auth-role"
              type="button"
              onClick={() => navigate("/manager/register")}
            >
              <span className="unified-auth-role-icon">
                <i className="ph ph-storefront" />
              </span>
              <span>
                <b>Register as a restaurant manager</b>
                <small>List and manage your restaurant</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
            <button
              className="unified-auth-role"
              type="button"
              onClick={() => navigate("/restaurant-staff/register")}
            >
              <span className="unified-auth-role-icon">
                <i className="ph ph-identification-card" />
              </span>
              <span>
                <b>Register as restaurant staff</b>
                <small>Request access to a restaurant team</small>
              </span>
              <i className="ph ph-caret-right" />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
