import { createAction } from "../../../app/actions.js";
import { useState, useContext } from "react";
import { StaffContext } from "../context/StaffContext.js";
import { ErrorMsg, Icon, Toast } from "../components/StaffUI.jsx";
import { image } from "../utils/images.js";

export default function LoginPage() {
  const { navigate, api } = useContext(StaffContext);
  const [loginActionBusy, setLoginActionBusy] = useState(false);
  const [loginActionError, setLoginActionError] = useState("");
  const [loginActionRun] = useState(() => createAction(setLoginActionBusy, setLoginActionError));
  const loginAction = {
    busy: loginActionBusy,
    error: loginActionError,
    setError: setLoginActionError,
    run: loginActionRun,
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [toast, setToast] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    loginAction.run(async () => {
      try {
        await api.login(email, password);
        navigate("check-in");
      } catch (err) {
        const msg = err.message || "";
        if (
          msg.toLowerCase().includes("pending manager approval") ||
          msg.toLowerCase().includes("approval")
        ) {
          setToast({
            message: "Your account is pending manager approval. We'll notify you when approved!",
            type: "warning",
          });
        } else {
          setToast({
            message: msg || "Invalid credentials. Please try again.",
            type: "error",
          });
        }
        throw err;
      }
    });
  };

  return (
    <div className="split-layout">
      {/* Left Banner */}
      <div
        className="banner-section"
        style={{ backgroundImage: `url(${image("staff-hero-bg.png")})` }}
      >
        <div className="banner-overlay" />
        <a href="/" className="back-link" aria-label="Back to home">
          <Icon name="chevron-left" />
        </a>
        <div className="banner-content">
          <div className="brand">
            <img
              src={image("logo.png")}
              alt="DineTime Logo"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                objectFit: "contain",
                marginRight: 8,
              }}
            />
            <span className="brand-name">DineTime</span>
          </div>
          <h1 className="hero-text">Service Starts Here</h1>
          <p className="hero-subtext">
            Manage tables, check in diners, and deliver seamless dining experiences.
          </p>
          <ul className="feature-list">
            <li>
              <Icon name="circle-check" className="fa-regular" /> Manage Table Status
            </li>
            <li>
              <Icon name="circle-check" className="fa-regular" /> Track Reservations
            </li>
            <li>
              <Icon name="circle-check" className="fa-regular" /> Monitor Food Orders
            </li>
          </ul>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="form-section">
        <div className="form-container">
          <div className="form-header">
            <h2>Staff Login</h2>
            <p>Access the restaurant operations dashboard.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="staff-id">Staff ID or Email</label>
              <input
                type="text"
                id="staff-id"
                placeholder="Enter your staff ID or email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <i
                  className={`fa-regular toggle-password ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                  onClick={() => setShowPassword(!showPassword)}
                />
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-container">
                <input type="checkbox" id="remember-me" />
                <span className="checkmark" />
                <span className="checkbox-label">Remember this device</span>
              </label>
              <a
                href="#"
                className="forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  setResetSent(false);
                  setShowForgotPassword(true);
                }}
              >
                Forgot Password?
              </a>
            </div>

            <ErrorMsg message={loginAction.error} />

            {loginAction.error && loginAction.error.toLowerCase().includes("approval") && (
              <div style={{ marginTop: "4px", marginBottom: "14px", textAlign: "center" }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("request");
                  }}
                  style={{
                    color: "var(--btn-primary)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  View Approval Request Status &rarr;
                </a>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loginAction.busy}>
              {loginAction.busy ? "Authenticating..." : "Login to Dashboard"}
            </button>
          </form>

          <div className="form-footer">
            <p>
              Don't have an account?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("register");
                }}
              >
                Create Account
              </a>
            </p>
          </div>
        </div>

        <div className="system-footer">
          <p>Restaurant Staff Portal &bull; DineTime System</p>
        </div>
      </div>

      {showForgotPassword && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowForgotPassword(false);
              setResetSent(false);
            }
          }}
        >
          <div className="modal-content">
            <button
              type="button"
              className="close-modal"
              aria-label="Close"
              style={{ border: 0, background: "none", padding: 0 }}
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
              }}
            >
              <Icon name="xmark" />
            </button>
            <h2 id="reset-title">Reset Password</h2>
            <p style={{ marginBottom: 24, color: "var(--text-muted)", fontSize: 14 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setResetSent(true);
                window.setTimeout(() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetEmail("");
                }, 2500);
              }}
            >
              <div className="form-group">
                <label htmlFor="reset-email">Email Address</label>
                <input
                  type="email"
                  id="reset-email"
                  placeholder="Enter your email"
                  required
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: 10 }}>
                Send Reset Link
              </button>
            </form>
            {resetSent && (
              <div
                id="reset-success-msg"
                role="status"
                style={{
                  color: "#4f6f52",
                  background: "rgba(79,111,82,0.1)",
                  padding: 12,
                  borderRadius: 8,
                  textAlign: "center",
                  marginTop: 16,
                  fontWeight: 500,
                }}
              >
                <span style={{ marginRight: 6 }}>
                  <Icon name="circle-check" />
                </span>
                A reset link has been sent to your email!
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
