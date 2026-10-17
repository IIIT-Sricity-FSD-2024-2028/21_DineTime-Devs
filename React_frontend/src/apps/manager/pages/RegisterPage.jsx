import { useState, useContext, useEffect } from "react";
import { requireApiBase } from "../api/config";
import { ToastContext } from "../context/ToastContext.jsx";
import { INDIAN_CITIES, VERIFICATION_TEAM_BY_STATE } from "../data/indianCities.js";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  confirm: "",
  license: "",
  authorized: false,
  document: null,
  restaurantName: "",
  cuisine: "",
  description: "",
  restaurantPhone: "",
  city: "",
  address: "",
  state: "",
  pincode: "",
  verificationLocationId: "",
};

export default function RegisterPage({ navigate }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [verificationTeams, setVerificationTeams] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useContext(ToastContext);
  const states = [...new Set(INDIAN_CITIES.map(({ state }) => state))].sort((a, b) =>
    a.localeCompare(b),
  );
  const cities = INDIAN_CITIES.filter(({ state }) => !form.state || state === form.state);
  const mappedTeamId = VERIFICATION_TEAM_BY_STATE[form.state];
  const nearestTeam =
    verificationTeams.find(({ location_id }) => location_id === mappedTeamId) ||
    verificationTeams[0];

  useEffect(() => {
    if (step !== 3 || verificationTeams.length) return;
    fetch(`${requireApiBase()}/verification/teams`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load verification teams.");
        return response.json();
      })
      .then((payload) => setVerificationTeams(payload?.data || []))
      .catch((error) => showToast(error.message, "error"));
  }, [step, verificationTeams.length, showToast]);

  useEffect(() => {
    if (step !== 3 || !verificationTeams.length || !form.state || form.verificationLocationId)
      return;
    const preferredTeamId = VERIFICATION_TEAM_BY_STATE[form.state];
    const preferredTeam =
      verificationTeams.find(({ location_id }) => location_id === preferredTeamId) ||
      verificationTeams[0];
    if (preferredTeam) {
      setForm((current) => ({ ...current, verificationLocationId: preferredTeam.location_id }));
    }
  }, [step, verificationTeams, form.state, form.verificationLocationId]);

  const update = (event) => {
    const { name, value, type, checked, files } = event.target;
    const nextValue = type === "checkbox" ? checked : type === "file" ? files?.[0] || null : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
  };

  const updateCity = (event) => {
    const city = event.target.value;
    const selectedCity = INDIAN_CITIES.find((item) => item.city === city);
    const state = selectedCity?.state || "";
    const mappedTeam = verificationTeams.find(
      ({ location_id }) => location_id === VERIFICATION_TEAM_BY_STATE[state],
    );
    setForm((current) => ({
      ...current,
      city,
      state,
      verificationLocationId: mappedTeam?.location_id || verificationTeams[0]?.location_id || "",
    }));
  };

  const updateState = (event) => {
    const state = event.target.value;
    const mappedTeam = verificationTeams.find(
      ({ location_id }) => location_id === VERIFICATION_TEAM_BY_STATE[state],
    );
    setForm((current) => ({
      ...current,
      state,
      city:
        current.city &&
        INDIAN_CITIES.some((item) => item.city === current.city && item.state === state)
          ? current.city
          : "",
      verificationLocationId: mappedTeam?.location_id || verificationTeams[0]?.location_id || "",
    }));
  };

  const updateRestaurantPhone = (event) => {
    const restaurantPhone = event.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((current) => ({ ...current, restaurantPhone }));
  };

  const goToRestaurant = () => {
    if (
      !form.name ||
      !form.phone ||
      !form.email ||
      !form.password ||
      !form.confirm ||
      !form.license ||
      !form.authorized ||
      !form.document
    ) {
      showToast("Please complete all required manager and verification fields.", "error");
      return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      showToast("Phone number must be exactly 10 digits.", "error");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    if (form.password.length < 8) {
      showToast("Password must be at least 8 characters long.", "error");
      return;
    }
    if (form.password !== form.confirm) {
      showToast("Passwords do not match.", "error");
      return;
    }
    if (!/^BL-[A-Z]{2}-\d{4}$/i.test(form.license)) {
      showToast(
        "Invalid license format. Expected format: BL-AB-1234 (BL, two letters, four digits)",
        "error",
      );
      return;
    }

    setStep(2);
  };

  const goToLocation = () => {
    if (!form.restaurantName.trim() || !form.cuisine) {
      showToast("Please complete the required restaurant details.", "error");
      return;
    }
    if (!/^\d{10}$/.test(form.restaurantPhone)) {
      showToast("Restaurant contact number must contain exactly 10 digits.", "error");
      return;
    }
    setStep(3);
  };

  const submit = async (event) => {
    event.preventDefault();
    const city = form.city.trim();
    if (!/^[\p{L}]+(?:[-'][\p{L}]+)*$/u.test(city)) {
      showToast("Enter the city as one word, without spaces.", "error");
      return;
    }
    if (
      !form.address.trim() ||
      !form.state.trim() ||
      !/^\d{6}$/.test(form.pincode) ||
      !form.verificationLocationId
    ) {
      showToast(
        "Enter the address, state, pincode, and wait for the assigned Verification Team.",
        "error",
      );
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("email", form.email.toLowerCase());
      body.append("phone", form.phone);
      body.append("password", form.password);
      body.append("business_license_number", form.license.toUpperCase());
      body.append("city", city);
      body.append("address", form.address.trim());
      body.append("state", form.state.trim());
      body.append("pincode", form.pincode);
      body.append("verification_location_id", form.verificationLocationId);
      body.append("restaurant_phone", form.restaurantPhone);
      body.append("restaurant_name", form.restaurantName);
      body.append("cuisine_type", form.cuisine.charAt(0).toUpperCase() + form.cuisine.slice(1));
      body.append("description", form.description || `${form.restaurantName} restaurant.`);
      body.append("document", form.document);
      const response = await fetch(`${requireApiBase()}/managers/register`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          Array.isArray(payload.message)
            ? payload.message.join(", ")
            : payload.message || "Registration failed.",
        );
      }
      showToast("Application submitted! You can log in once it is verified.");
      setTimeout(() => navigate("login"), 1800);
    } catch (error) {
      showToast(error.message, "error");
      setSubmitting(false);
    }
  };

  const field = (label, name, type = "text", extra = {}) => (
    <label className="login-form-group" key={name}>
      <span className="login-label">{label}</span>
      {type === "file" ? (
        <div className="file-upload-container">
          <label
            className="file-upload-box"
            style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}
          >
            <input
              type="file"
              name={name}
              onChange={update}
              style={{ display: "none" }}
              {...extra}
            />
            <div
              className="file-upload-icon"
              style={{ margin: 0, width: 36, height: 36, fontSize: 18 }}
            >
              <i className="ph ph-upload-simple" />
            </div>
            <div className="file-upload-text" style={{ textAlign: "left" }}>
              <h4 style={{ fontSize: 14, margin: 0, color: "var(--text-dark)" }}>
                {form[name] ? form[name].name : "Click to choose a file"}
              </h4>
              {!form[name] && <p style={{ margin: 0, fontSize: 12 }}>Accepts images or PDF</p>}
            </div>
          </label>
        </div>
      ) : (
        <input
          className="login-input no-icon"
          name={name}
          type={type}
          value={form[name]}
          onChange={update}
          {...extra}
        />
      )}
    </label>
  );

  const renderStep = () => {
    if (step === 1) {
      return (
        <>
          {field("Manager Name *", "name", "text", {
            placeholder: "e.g. Jane Doe",
            required: true,
          })}
          {field("Manager Phone *", "phone", "tel", { maxLength: 10, required: true })}
          {field("Manager Email *", "email", "email", {
            placeholder: "manager@restaurant.com",
            required: true,
          })}
          {field("Password *", "password", "password", {
            placeholder: "Min. 8 characters",
            required: true,
          })}
          {field("Confirm Password *", "confirm", "password", { required: true })}
          <div className="business-divider">Business Verification</div>
          {field("Business License Number *", "license", "text", {
            placeholder: "e.g. BL-AB-1234",
            required: true,
          })}
          {field("Verification Document *", "document", "file", {
            accept: "image/jpeg,image/png,image/webp,application/pdf",
            required: true,
          })}
          <label className="auth-checkbox-group">
            <input type="checkbox" name="authorized" checked={form.authorized} onChange={update} />{" "}
            I confirm that I am authorized to manage this restaurant.
          </label>
          <button className="btn-login" type="button" onClick={goToRestaurant}>
            Add Restaurant details <i className="ph ph-arrow-right" />
          </button>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          {field("Restaurant Name *", "restaurantName", "text", { required: true })}
          <label className="login-form-group">
            <span className="login-label">Cuisine Type *</span>
            <select
              className="login-input no-icon"
              name="cuisine"
              value={form.cuisine}
              onChange={update}
              required
            >
              <option value="">Select cuisine type</option>
              <option value="italian">Italian</option>
              <option value="indian">Indian</option>
              <option value="chinese">Chinese</option>
              <option value="continental">Continental</option>
              <option value="mexican">Mexican</option>
            </select>
          </label>
          <label className="login-form-group">
            <span className="login-label">Restaurant Description</span>
            <textarea
              className="login-input textarea-input no-icon"
              name="description"
              value={form.description}
              onChange={update}
            />
          </label>
          <label className="login-form-group">
            <span className="login-label">Restaurant Contact Number *</span>
            <input
              className="login-input no-icon"
              name="restaurantPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={form.restaurantPhone}
              onChange={updateRestaurantPhone}
              maxLength={10}
              pattern="[0-9]{10}"
              placeholder="10-digit phone number"
              required
            />
          </label>
          <div className="step-actions">
            <button className="btn-login" type="button" onClick={goToLocation}>
              Set Restaurant location <i className="ph ph-arrow-right" />
            </button>
            <button className="btn-back-step" type="button" onClick={() => setStep(1)}>
              <i className="ph ph-arrow-left" /> Back to Manager Setup
            </button>
          </div>
        </>
      );
    }
    return (
      <>
        <label className="login-form-group">
          <span className="login-label">City *</span>
          <select
            className="login-input no-icon"
            name="city"
            value={form.city}
            onChange={updateCity}
            required
          >
            <option value="">Choose a city</option>
            {cities.map(({ city }) => (
              <option value={city} key={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
        {field("Street address / area *", "address", "text", {
          placeholder: "Building, street, area",
          required: true,
        })}
        <label className="login-form-group">
          <span className="login-label">State *</span>
          <select
            className="login-input no-icon"
            name="state"
            value={form.state}
            onChange={updateState}
            required
          >
            <option value="">Choose a state or union territory</option>
            {states.map((state) => (
              <option value={state} key={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        {field("Pincode *", "pincode", "text", {
          inputMode: "numeric",
          maxLength: 6,
          pattern: "[0-9]{6}",
          required: true,
        })}
        <div className="login-form-group">
          <span className="login-label">Verification Team</span>
          <div
            className="login-input no-icon"
            aria-live="polite"
            style={{ display: "flex", alignItems: "center" }}
          >
            {nearestTeam
              ? `${nearestTeam.city} Verification Team (Nearest team)`
              : verificationTeams.length
                ? "Choose a city to assign a team"
                : "Loading available teams..."}
          </div>
          <small>
            {nearestTeam
              ? `Your application will be reviewed by the ${nearestTeam.city} team.`
              : "Verification team locations are managed by the platform administrator."}
          </small>
        </div>
        <div className="step-actions">
          <button className="btn-login" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit for Verification"} <i className="ph ph-check" />
          </button>
          <button className="btn-back-step" type="button" onClick={() => setStep(2)}>
            <i className="ph ph-arrow-left" /> Back to Restaurant Details
          </button>
        </div>
      </>
    );
  };

  const titles = [
    "Register Your Restaurant on DineTime",
    "Add Your Restaurant to DineTime",
    "Set Your Restaurant Location",
  ];
  const descriptions = [
    "Create a manager account to manage your restaurant, track reservations, and optimize seating capacity.",
    "List your restaurant so diners can discover it, reserve tables, and enjoy a seamless dining experience.",
    "Add the restaurant's city and full address. These details will be shown to diners.",
  ];

  return (
    <div className="login-page registration-page">
      <div className="login-left">
        <div className="login-left-overlay" />
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("login");
          }}
          className="login-back-arrow"
        >
          <i className="ph ph-arrow-left" />
        </a>
        <div className="login-left-brand">
          <img className="login-left-brand-icon" src="/assets/logo.png" alt="DineTime Logo" />
          <span className="login-left-brand-name">DineTime</span>
        </div>
        <div className="login-left-content">
          <h1>{titles[step - 1]}</h1>
          <p>{descriptions[step - 1]}</p>
          <ul className="reg-feature-list">
            <li>
              <i className="ph ph-calendar-check" /> Manage reservations easily
            </li>
            <li>
              <i className="ph ph-users-four" />{" "}
              {step === 1
                ? "Monitor table availability"
                : step === 2
                  ? "Optimize seating capacity"
                  : "Reach diners in your area"}
            </li>
            <li>
              <i className="ph ph-chart-line-up" />{" "}
              {step === 3 ? "Get reviewed by our Verification Team" : "Grow your customer reach"}
            </li>
          </ul>
          <div className="verified-badge-card">
            <div className="verified-badge-icon">
              <i className="ph ph-shield-check" />
            </div>
            <div className="verified-badge-text">
              <h4>Verified Restaurant Partners</h4>
              <p>
                All accounts go through our verification process to ensure trusted dining
                experiences.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="login-right">
        <div className="login-right-logo">
          <img className="login-right-logo-icon" src="/assets/logo.png" alt="DineTime Logo" />
          <span className="login-right-logo-name">DineTime</span>
        </div>
        <form className="login-card" onSubmit={submit}>
          <h2>
            {step === 1
              ? "Create Manager Account"
              : step === 2
                ? "Restaurant Details"
                : "Restaurant Location"}
          </h2>
          <p className="login-subtitle">
            {step === 1 ? (
              <>
                Already have an account?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("login");
                  }}
                  className="forgot-link"
                >
                  Sign in
                </a>
              </>
            ) : step === 2 ? (
              "Tell us about your restaurant."
            ) : (
              "Select which serviceable location your restaurant belongs to."
            )}
          </p>
          {renderStep()}
        </form>
        <div className="login-footer">
          <div className="login-copyright">© 2026 DineTime. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
