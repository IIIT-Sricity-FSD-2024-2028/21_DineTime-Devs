import { useState, useContext } from "react";
import { StaffContext } from "../context/StaffContext.js";
import { Icon, Toast } from "../components/StaffUI.jsx";

export default function RequestPage() {
  const { navigate } = useContext(StaffContext);
  const [showToast, setShowToast] = useState(false);

  return (
    <div className="request-layout">
      {/* Left Section */}
      <div className="request-info-section">
        <h1 className="hero-title">Request Submitted</h1>
        <p className="hero-desc">
          Your staff access request has been sent to the restaurant manager.
        </p>

        <ul className="status-steps">
          <li>
            <Icon name="circle-check" className="fa-regular step-icon" />
            <span>Your account is currently pending approval</span>
          </li>
          <li>
            <Icon name="clock" className="fa-regular step-icon" />
            <span>The restaurant manager will review your request</span>
          </li>
          <li>
            <Icon name="envelope" className="fa-regular step-icon" />
            <span>You will receive access once approved</span>
          </li>
          <li>
            <Icon name="bell" className="fa-regular step-icon" />
            <span>You can enable notifications for approval updates</span>
          </li>
        </ul>
      </div>

      {/* Right Card Section */}
      <div className="request-card-section">
        <div className="status-card">
          <div className="status-icon-container">
            <div className="status-icon-ring">
              <Icon name="clock" className="fa-regular" />
            </div>
          </div>

          <h2>Waiting for Manager Approval</h2>
          <p>
            Your request has been successfully submitted. The restaurant manager must approve your
            staff access before you can log in.
          </p>

          <div className="badge-container">
            <span className="badge-pending">Pending Approval</span>
          </div>

          <div className="action-buttons">
            <button type="button" className="btn-primary" onClick={() => setShowToast(true)}>
              <Icon name="bell" className="fa-regular" /> Notify Me When Approved
            </button>
            <a
              href="#"
              className="btn-outline"
              onClick={(e) => {
                e.preventDefault();
                navigate("login");
              }}
            >
              Back to Login
            </a>
          </div>

          <p className="footer-note">Approval time depends on manager review.</p>
        </div>
      </div>

      {showToast && (
        <Toast message="We'll notify you when approved!" onDismiss={() => setShowToast(false)} />
      )}
    </div>
  );
}
