import { createAction } from "../../../app/actions.js";
import { useState, useContext } from "react";
import { StaffContext } from "../context/StaffContext.js";
import { ErrorMsg, Icon } from "../components/StaffUI.jsx";
import { image } from "../utils/images.js";

export default function RegisterPage() {
  const { navigate, api } = useContext(StaffContext);
  const [registerActionBusy, setRegisterActionBusy] = useState(false);
  const [registerActionError, setRegisterActionError] = useState("");
  const [registerActionRun] = useState(() =>
    createAction(setRegisterActionBusy, setRegisterActionError),
  );
  const registerAction = {
    busy: registerActionBusy,
    error: registerActionError,
    setError: setRegisterActionError,
    run: registerActionRun,
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    restaurantId: "",
    pincode: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    // For phone/pincode, only digits
    if (id === "phone" || id === "pincode") {
      setFormData({ ...formData, [id]: value.replace(/[^0-9]/g, "") });
    } else {
      setFormData({ ...formData, [id]: value });
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(formData.phone)) {
      registerAction.setError("Phone number must be exactly 10 digits.");
      return;
    }
    if (!/^\d{6}$/.test(formData.pincode)) {
      registerAction.setError("Pincode must be exactly 6 digits.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      registerAction.setError("Passwords do not match.");
      return;
    }
    if (formData.password.length < 8) {
      registerAction.setError("Password must be at least 8 characters.");
      return;
    }

    registerAction.run(async () => {
      await api.register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        restaurantId: formData.restaurantId,
        pincode: formData.pincode,
      });
      navigate("request");
    });
  };

  return (
    <div className="registration-layout">
      {/* Left Features Section */}
      <div className="features-section">
        <div className="brand">
          <img
            src={image("logo.png")}
            alt="DineTime Logo"
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain", marginRight: 8 }}
          />
          <span className="brand-name">DineTime</span>
        </div>

        <h1 className="hero-title">Join Restaurant Staff</h1>
        <p className="hero-desc">
          Create a staff account to manage reservations, verify check-ins, and assist diners.
        </p>

        <ul className="benefits-list">
          <li>
            <div className="icon-box">
              <Icon name="calendar-check" className="fa-regular" />
            </div>
            <span>Manage upcoming reservations</span>
          </li>
          <li>
            <div className="icon-box">
              <Icon name="user-check" />
            </div>
            <span>Verify customer check-ins</span>
          </li>
          <li>
            <div className="icon-box">
              <Icon name="border-all" />
            </div>
            <span>Update table availability</span>
          </li>
          <li>
            <div className="icon-box">
              <Icon name="people-group" />
            </div>
            <span>Improve service coordination</span>
          </li>
        </ul>

        <div className="approval-notice">
          <div className="notice-icon">
            <Icon name="circle-check" className="fa-regular" />
          </div>
          <div className="notice-text">
            <strong>Manager Approval Required</strong>
            <p>
              All staff accounts must be approved by the restaurant manager before gaining access.
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="form-section">
        <div className="form-container">
          <div className="form-header">
            <h2>Staff Registration</h2>
            <p>Submit your details to request staff access.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  placeholder="Jane Smith"
                  required
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="jane@restaurant.com"
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  placeholder="9876543210"
                  required
                  maxLength="10"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="restaurantId">Restaurant ID</label>
                <input
                  type="text"
                  id="restaurantId"
                  placeholder="e.g. res_1"
                  required
                  value={formData.restaurantId}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pincode">Home Pincode</label>
                <input
                  type="text"
                  id="pincode"
                  placeholder="6-digit pincode"
                  required
                  maxLength="6"
                  value={formData.pincode}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group" style={{ visibility: "hidden" }}>
                <label>Placeholder</label>
                <input type="text" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Min. 8 characters"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <i
                    className={`fa-regular toggle-password ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-with-icon">
                  <input
                    type={showConfirm ? "text" : "password"}
                    id="confirmPassword"
                    placeholder="Re-enter password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  <i
                    className={`fa-regular toggle-password ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}
                    onClick={() => setShowConfirm(!showConfirm)}
                  />
                </div>
              </div>
            </div>

            <ErrorMsg message={registerAction.error} />

            <button type="submit" className="btn-primary" disabled={registerAction.busy}>
              {registerAction.busy ? "Submitting..." : "Request Staff Access"}
            </button>
          </form>

          <div className="form-footer">
            <p>
              Already have an account?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("login");
                }}
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
