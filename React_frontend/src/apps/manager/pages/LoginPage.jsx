import { useState } from "react";
import { requireApiBase } from "../api/config";
import managerApi from "../api/managerApi";

export default function LoginPage({ navigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(`${requireApiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          Array.isArray(payload.message)
            ? payload.message.join(", ")
            : payload.message || "Invalid login credentials.",
        );
      }
      const auth = await response.json();
      if (auth?.user?.role !== "manager")
        throw new Error("This account is not a restaurant manager.");
      if (auth?.user?.status !== "active")
        throw new Error("Your manager account is awaiting verification.");
      await managerApi.login(auth.user.email, auth.access_token || "");
      navigate("profile");
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  const sendReset = async (event) => {
    event.preventDefault();
    const resetEmail = event.currentTarget.elements
      .namedItem("reset-email")
      .value.trim()
      .toLowerCase();
    try {
      const response = await fetch(`${requireApiBase()}/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      if (!response.ok) throw new Error("Unable to submit the reset request.");
      setResetSent(true);
      setTimeout(() => setForgotOpen(false), 3000);
    } catch (resetError) {
      setError(resetError.message);
      setForgotOpen(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-overlay" />
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.location.href = "/"; }}
          className="login-back-arrow"
        >
          <i className="ph ph-arrow-left" />
        </a>
        <div className="login-left-brand">
          <img className="login-left-brand-icon" src="/assets/logo.png" alt="DineTime Logo" />
          <span className="login-left-brand-name">DineTime</span>
        </div>
        <div className="login-left-content">
          <h1>
            Master Your
            <br />
            Operations
          </h1>
          <p>
            Manage tables, track real-time reservations, and optimize your
            restaurant&apos;s performance with ease.
          </p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-right-logo">
          <img className="login-right-logo-icon" src="/assets/logo.png" alt="DineTime Logo" />
          <span className="login-right-logo-name">DineTime</span>
        </div>
        <form className="login-card" onSubmit={submit} noValidate>
          <h2>Welcome Back</h2>
          <p className="login-subtitle">
            Login to manage your restaurant operations and seating
          </p>
          <div className="login-form-group">
            <div className="login-label-row">
              <label className="login-label" htmlFor="email-input">
                Email or Username
              </label>
            </div>
            <div className="login-input-wrapper">
              <i className="ph ph-envelope-simple login-input-icon" />
              <input
                id="email-input"
                className="login-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                required
              />
            </div>
          </div>
          <div className="login-form-group">
            <div className="login-label-row">
              <label className="login-label" htmlFor="password-input">
                Password
              </label>
              <button
                className="forgot-link"
                type="button"
                onClick={() => { setForgotOpen(true); setResetSent(false); }}
              >
                Forgot Password?
              </button>
            </div>
            <div className="login-input-wrapper">
              <i className="ph ph-lock-simple login-input-icon" />
              <input
                id="password-input"
                className="login-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-eye-btn"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword((v) => !v)}
              >
                <i className={`ph ${showPassword ? "ph-eye-slash" : "ph-eye"}`} />
              </button>
            </div>
          </div>
          {error && <p className="login-field-error show">{error}</p>}
          <button className="btn-login" type="submit">
            Login
          </button>
          <div className="divider">
            <span>OR</span>
          </div>
          <div className="social-buttons-container">
            <button
              type="button"
              className="btn-social-outline"
              onClick={() => alert("Google sign-in is not connected yet.")}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: 20, height: 20 }} />
              Continue with Google
            </button>
            <button
              type="button"
              className="btn-social-outline"
              onClick={() => alert("Apple sign-in is not connected yet.")}
            >
              <i className="ph-fill ph-apple-logo" style={{ color: '#000', fontSize: 22 }} />
              Continue with Apple
            </button>
          </div>
        </form>
        <div className="login-register-row">
          Don&apos;t have an account?{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("register"); }}>
            Create Account
          </a>
        </div>
        <div className="login-footer">
          <div className="login-footer-links">
            <a href="#">Terms of Service</a>
            <span>•</span>
            <a href="#">Privacy Policy</a>
          </div>
          <div className="login-copyright">© 2026 DineTime. All rights reserved.</div>
        </div>
      </div>
      {forgotOpen && (
        <div className="modal" style={{ display: "flex" }}>
          <div className="modal-content">
            <button className="close-modal" type="button" onClick={() => setForgotOpen(false)}>
              <i className="ph ph-x" />
            </button>
            <h2>Reset Password</h2>
            {resetSent ? (
              <div className="reset-success-msg">
                <i className="ph ph-check-circle" /> If an account exists, reset
                instructions will be sent to your email.
              </div>
            ) : (
              <form onSubmit={sendReset}>
                <p>Enter your email address to request password reset instructions.</p>
                <div className="login-form-group">
                  <label className="login-label" htmlFor="reset-email">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    className="login-input"
                    type="email"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <button className="btn-login" type="submit">
                  Send Reset Link
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
