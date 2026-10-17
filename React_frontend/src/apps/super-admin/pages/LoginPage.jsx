import { useState, useContext } from "react";
import logoUrl from "../assets/logo.png";
import { AuthContext } from "../context/AuthContext.jsx";

export function LoginPage() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await login(email.trim().toLowerCase(), password.trim());
      window.history.pushState({}, "", "/super-admin/super-dashboard");
    } catch (error) {
      setErrorMessage(error?.message || "Master credentials invalid.");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  }

  return (
    <div className="split-container">
      <section className="banner-side">
        <div className="banner-overlay" />
        <div className="banner-content">
          <div className="brand">
            <img
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                objectFit: "contain",
                background: "rgba(255,255,255,0.08)",
                padding: 6,
                border: "1px solid rgba(163, 181, 164, 0.2)",
              }}
              src={logoUrl}
              alt="DineTime Logo"
            />
            <span>
              DineTime <small>COMMAND</small>
            </span>
          </div>
          <h1 className="hero-title">Master Platform</h1>
          <p className="hero-subtitle">
            Authentication required to access global network controls, system operations, and
            regional scaling tools.
          </p>
        </div>
      </section>
      <section className="form-side">
        <div className="login-card">
          <div className="card-header">
            <h2>Master Access</h2>
            <p>Enter your authorization credentials.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="superEmail">Master Email</label>
              <input
                type="email"
                id="superEmail"
                placeholder="admin@dinetime.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="superPassword">Security Key</label>
              <div className="password-input">
                <input
                  type="password"
                  id="superPassword"
                  placeholder="Enter root password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-login">
              Verify Authentication
            </button>
            <div className="demo-override" style={{ marginTop: "1.5rem", textAlign: "center" }}>
              <span
                style={{ fontSize: "0.8rem", color: "var(--text-muted)", cursor: "help" }}
                title="Default: admin@dinetime.com / admin123"
              >
                <i className="ph ph-info" /> Missing keys? Check console logs.
              </span>
            </div>
          </form>
        </div>
        <footer className="footer">
          <p className="copyright">&copy; 2026 DineTime Platform. Internal Use Only.</p>
        </footer>
      </section>
      <div className={`toast-popup ${showError ? "" : "hidden"}`}>
        <i className="ph ph-warning-circle" style={{ fontSize: 20 }} /> {errorMessage}
      </div>
    </div>
  );
}
