import { useState } from "react";
import AuthLayout, { SocialButtons } from "../components/AuthLayout.jsx";
import { Field, PasswordField } from "../components/Fields.jsx";
import { ErrorMessage, Modal } from "../components/Feedback.jsx";
import { PageLink } from "../components/Navigation.jsx";
import { useAction, useDiner } from "../hooks/useDiner.js";

export default function LoginPage() {
  const { api, navigate, booking, currentPage, params } = useDiner();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const { run, busy, error, setError } = useAction();
  function submit(event) {
    event.preventDefault();
    run(async () => {
      await api.login(email, password);
      if (booking) navigate("payment_making");
      else if (currentPage !== "login") navigate(currentPage, params);
      else navigate("browse");
    });
  }
  return (
    <AuthLayout>
      <div className="login-card">
        <div className="card-header">
          <h2>Welcome Back</h2>
          <p>Login to book tables and manage your dining reservations.</p>
        </div>
        <form onSubmit={submit}>
          <Field
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="label-row">
            <button
              type="button"
              className="forgot-link text-button"
              onClick={() => setForgot(true)}
            >
              Forgot Password?
            </button>
          </div>
          <PasswordField
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <ErrorMessage message={error} />
          <button className="btn btn-login" disabled={busy}>
            {busy ? "Logging in…" : "Login"}
          </button>
          <SocialButtons onSelect={setError} />
          <p className="signup-prompt">
            Don't have an account?{" "}
            <PageLink page="register">Create Account</PageLink>
          </p>
        </form>
      </div>
      {forgot && (
        <Modal title="Reset Password" onClose={() => setForgot(false)}>
          <p>
            Password recovery is not connected to the backend yet. Contact
            support to recover your account.
          </p>
          <button className="btn btn-login" onClick={() => setForgot(false)}>
            Back to Login
          </button>
        </Modal>
      )}
    </AuthLayout>
  );
}
