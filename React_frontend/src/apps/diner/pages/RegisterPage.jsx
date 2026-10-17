import { createAction } from "../../../app/actions.js";
import { useState, useContext, useEffect } from "react";
import AuthLayout from "../components/AuthLayout.jsx";
import { Field, PasswordField } from "../components/Fields.jsx";
import { ErrorMessage } from "../components/Feedback.jsx";
import { PageLink } from "../components/Navigation.jsx";
import { DinerContext } from "../context/DinerContext.js";
import LocationMap from "../components/LocationMap.jsx";

export default function RegisterPage() {
  const { api, navigate } = useContext(DinerContext);
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
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  useEffect(() => {
    let active = true;
    api
      .cities()
      .then((items) => {
        if (active) setCities(items);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const bind = (key) => ({
    value: account[key],
    onChange: (event) => setAccount({ ...account, [key]: event.target.value }),
  });
  function next(event) {
    event.preventDefault();
    if (account.password !== account.confirm) return setError("Passwords do not match.");
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
          <h2>{step === 1 ? "Create Your Diner Account" : "Set Your Location"}</h2>
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
                onChange={(coordinates) => setLocation({ ...location, ...coordinates })}
              />
            </div>
            <Field
              label="Address"
              value={location.address}
              onChange={(event) => setLocation({ ...location, address: event.target.value })}
              required
            />
            <div className="form-group">
              <label htmlFor="registration-preferred-city">Preferred city</label>
              <select
                id="registration-preferred-city"
                className="form-control"
                value={location.city}
                required
                disabled={citiesLoading || !cities.length}
                onChange={(event) => setLocation({ ...location, city: event.target.value })}
              >
                <option value="" disabled>
                  {citiesLoading
                    ? "Loading cities…"
                    : cities.length
                      ? "Choose a city"
                      : "No restaurant cities available"}
                </option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row form-row-2col">
              <Field
                label="Pincode / ZIP"
                value={location.pincode}
                onChange={(event) => setLocation({ ...location, pincode: event.target.value })}
                maxLength={10}
              />
              <Field
                label="Country"
                value={location.country}
                onChange={(event) => setLocation({ ...location, country: event.target.value })}
                required
              />
            </div>
            <ErrorMessage message={error} />
            <div
              className="form-actions"
              style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}
            >
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
