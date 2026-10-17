import { useState } from "react";
import { bindSession, getTabId } from "../../app/session.js";
import { requireApiBase } from "../manager/api/config.js";
import heroImage from "../landing/images/restaurant-interior-hero.jpg";
import "./unified-auth.css";

const SESSION_KEYS = [
  "dinetime_react_diner_session",
  "manager_session_v1",
  "manager_backend_ids_v1",
  "dinetime_react_staff_session",
  "subadmin_auth_status",
  "subadmin_access_token",
  "subadmin_tab_id",
  "subadmin_profile",
  "super_auth_status",
  "super_access_token",
  "super_tab_id",
  "super_admin_profile",
];

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

async function readPayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message;
    if (
      response.status === 401 &&
      /invalid.*credential|invalid.*password|invalid.*email/i.test(String(message))
    ) {
      throw new Error("Invalid credentials");
    }
    throw new Error(Array.isArray(message) ? message.join(", ") : message || "Unable to sign in.");
  }
  return payload?.data ?? payload;
}

async function postLogin(base, path, credentials) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return readPayload(response);
}

async function authenticate(base, credentials) {
  try {
    const auth = await postLogin(base, "/auth/login", credentials);
    if (auth?.user?.role && auth?.access_token) return auth;
  } catch (_error) {
    // Admin roles use separate API login endpoints.
  }
  try {
    const user = await postLogin(base, "/super-admin/login", credentials);
    if (user?.access_token) return { access_token: user.access_token, user };
  } catch (_error) {
    // Sub-admin login also requires its team name.
  }
  let lastError;
  for (const team of ["support", "finance", "verification"]) {
    try {
      const user = await postLogin(base, "/sub-admin/login", { ...credentials, team });
      if (user?.access_token) return { access_token: user.access_token, user: { ...user, team } };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Invalid credentials");
}

export default function UnifiedAuthPage() {
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
      const base = requireApiBase();
      const auth = await authenticate(base, { email: email.trim().toLowerCase(), password });
      const user = auth?.user;
      if (!user?.role || !auth?.access_token)
        throw new Error("The server returned an incomplete login session.");
      if (user.status !== "active") {
        throw new Error(
          user.role === "manager"
            ? "Your manager account is awaiting verification."
            : "Your account is not active yet.",
        );
      }

      SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
      const { password_hash, ...safeUser } = user;

      if (user.role === "diner") {
        sessionStorage.setItem(
          "dinetime_react_diner_session",
          JSON.stringify(
            bindSession({
              access_token: auth.access_token,
              user: safeUser,
            }),
          ),
        );
      } else if (user.role === "manager") {
        sessionStorage.setItem(
          "manager_session_v1",
          JSON.stringify(
            bindSession({
              email: safeUser.email,
              access_token: auth.access_token,
            }),
          ),
        );
      } else if (user.role === "staff") {
        const headers = {
          role: "staff",
          Authorization: `Bearer ${auth.access_token}`,
        };
        const [profileResponse, restaurantsResponse] = await Promise.all([
          fetch(`${base}/users/${encodeURIComponent(user.id)}`, { headers }),
          fetch(`${base}/restaurants`, { headers }),
        ]);
        const [profile, restaurants] = await Promise.all([
          readPayload(profileResponse),
          readPayload(restaurantsResponse),
        ]);
        const restaurantId = profile?.restaurant_id;
        const restaurant = (Array.isArray(restaurants) ? restaurants : []).find(
          (item) => item.id === restaurantId,
        );
        if (!restaurantId || !restaurant)
          throw new Error("This staff account is not assigned to an active restaurant.");
        sessionStorage.setItem(
          "dinetime_react_staff_session",
          JSON.stringify(
            bindSession({
              access_token: auth.access_token,
              user: { ...safeUser, restaurantId, restaurantName: restaurant.name },
            }),
          ),
        );
      } else if (user.role === "super_user") {
        sessionStorage.setItem("super_auth_status", "true");
        sessionStorage.setItem("super_access_token", auth.access_token);
        sessionStorage.setItem("super_tab_id", getTabId());
        sessionStorage.setItem(
          "super_admin_profile",
          JSON.stringify(
            bindSession({
              id: safeUser.id,
              name: safeUser.name,
              email: safeUser.email,
              role: safeUser.role,
            }),
          ),
        );
        goToRole("superAdmin");
        return;
      } else if (["support_admin", "finance_admin", "verification_admin"].includes(user.role)) {
        const team =
          user.team ||
          {
            support_admin: "support",
            finance_admin: "finance",
            verification_admin: "verification",
          }[user.role];
        const profile = {
          id: safeUser.id,
          name: safeUser.name,
          email: safeUser.email,
          role: safeUser.role,
          team,
          location_id: safeUser.location_id,
        };
        sessionStorage.setItem("subadmin_auth_status", "true");
        sessionStorage.setItem("subadmin_access_token", auth.access_token);
        sessionStorage.setItem("subadmin_tab_id", getTabId());
        sessionStorage.setItem("subadmin_profile", JSON.stringify(bindSession(profile)));
        navigate(`/sub-admin/${team}-dashboard`);
        return;
      } else {
        throw new Error("This account type cannot use this sign-in page.");
      }

      goToRole(user.role);
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
