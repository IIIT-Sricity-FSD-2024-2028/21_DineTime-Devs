import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";

const destinations = {
  support: "/sub-admin/support-dashboard",
  verification: "/sub-admin/verification-dashboard",
  finance: "/sub-admin/finance-dashboard",
};

export function LoginPage() {
  const { login } = useContext(AuthContext);
  const [team, setTeam] = useState("support");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setHasError(false);
    try {
      const profile = await login({ team, email: email.trim().toLowerCase(), password });
      window.history.pushState({}, "", destinations[profile.team] || "/sub-admin/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (_error) {
      setHasError(true);
    }
  }

  return (
    <div className="sub-login-body">
      <div className="login-card">
        <div className="brand">
          <i className="fa-solid fa-user-shield" /> DineTime <small>SUB-ADMIN PORTAL</small>
        </div>
        <h2>Team Sign In</h2>
        <p className="subtitle">Sign in with the credentials provided by your Super Admin.</p>
        <div className={`error-msg ${hasError ? "show" : ""}`}>Invalid credentials</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="team">Team</label>
            <select
              id="team"
              required
              value={team}
              onChange={(event) => setTeam(event.target.value)}
            >
              <option value="support">Customer Support</option>
              <option value="finance">Finance Team</option>
              <option value="verification">Verification Team</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="you@dinetime.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit">Sign In</button>
        </form>
        <p className="hint">Accounts are created by the Super Admin under Sub-Admin Teams.</p>
      </div>
    </div>
  );
}
