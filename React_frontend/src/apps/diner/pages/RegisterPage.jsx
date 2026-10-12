import { useState } from "react";
import AuthLayout, { SocialButtons } from "../components/AuthLayout.jsx";
import { Field, LocationFields, PasswordField } from "../components/Fields.jsx";
import { ErrorMessage } from "../components/Feedback.jsx";
import { PageLink } from "../components/Navigation.jsx";
import { useAction, useDiner } from "../hooks/useDiner.js";
import LocationMap from "../components/LocationMap.jsx";

export default function RegisterPage() {
  const { api, navigate } = useDiner();
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [location, setLocation] = useState({
    address: "",
    city: "",
    pincode: "",
    country: "India",
  });
  const { run, busy, error, setError } = useAction();
  const bind = (key) => ({
    value: account[key],
    onChange: (event) => setAccount({ ...account, [key]: event.target.value }),
  });
  function next(event) {
    event.preventDefault();
    if (account.password !== account.confirm)
      return setError("Passwords do not match.");
    setError("");
    setStep(2);
  }
  function submit(event) {
    event.preventDefault();
    run(async () => {
      await api.register(account, location);
      navigate("browse");
    });
  }
  return (
    <AuthLayout register locationStep={step === 2}>
      <div className="step-card active">
        <div className="card-header">
          <h2>
            {step === 1 ? "Create Your Diner Account" : "Set Your Location"}
          </h2>
          <p>
            {step === 1
              ? "Start reserving tables in just a few steps"
              : "Help us find restaurants near you"}
          </p>
        </div>
        {step === 1 ? (
          <form onSubmit={next}>
            <Field
              label="Full Name"
              placeholder="Jane Smith"
              autoComplete="name"
              required
              {...bind("name")}
            />
            <Field
              label="Email Address"
              type="email"
              placeholder="jane@example.com"
              autoComplete="email"
              required
              {...bind("email")}
            />
            <Field
              label="Phone Number"
              type="tel"
              placeholder="9876543210"
              pattern="[0-9]{10}"
              maxLength={10}
              autoComplete="tel"
              required
              {...bind("phone")}
            />
            <PasswordField
              placeholder="Min. 8 characters"
              minLength={8}
              autoComplete="new-password"
              required
              {...bind("password")}
            />
            <PasswordField
              label="Confirm Password"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              {...bind("confirm")}
            />
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>I agree to the Terms of Service and Privacy Policy</span>
            </label>
            <ErrorMessage message={error} />
            <button className="btn btn-primary">Set Your Location</button>
            <SocialButtons onSelect={setError} />
            <p className="login-link">
              Already have an account? <PageLink page="login">Log in</PageLink>
            </p>
          </form>
        ) : (
          <form onSubmit={submit}>
            <div className="map-container">
              <LocationMap
                latitude={location.latitude}
                longitude={location.longitude}
                onChange={(coordinates) =>
                  setLocation({ ...location, ...coordinates })
                }
              />
            </div>
            <LocationFields value={location} onChange={setLocation} />
            <ErrorMessage message={error} />
            <div className="form-actions" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>
                {busy ? "Creating account…" : "Confirm and Continue"}
              </button>
              <button
                type="button"
                className="text-button"
                style={{ width: "100%", textAlign: "center" }}
                onClick={() => setStep(1)}
              >
                Back to account details
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
