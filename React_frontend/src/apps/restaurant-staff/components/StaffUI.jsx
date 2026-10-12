import { useEffect } from "react";
import { useStaff } from "../hooks/useStaff.js";
import { image } from "../utils/images.js";

/** Icon wrapper — uses FontAwesome class names just like the original HTML. */
export function Icon({ name, className = "" }) {
  return <i className={`fa-solid fa-${name} ${className}`} aria-hidden="true" />;
}

/** Top navigation bar used on dashboard, check-in, and profile pages. */
export function TopNav({ subtitle, showNotifications, onNotifications, showLogout = true }) {
  const { navigate, user, api } = useStaff();
  return (
    <header className="top-nav">
      <div className="nav-inner">
        <div className="logo-area">
          <img src={image("logo.png")} alt="DineTime Logo" className="logo" />
          <div className="brand-text">
            <h1>DineTime</h1>
            <span>{subtitle || user?.restaurantName || "Spice Garden"}</span>
          </div>
        </div>
        <div className="user-actions">
          {onNotifications && (
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={onNotifications}
            >
              <span className="bell-wrapper">
                <i className="fa-regular fa-bell" />
              </span>
            </button>
          )}
          <button
            className="user-profile"
            onClick={() => navigate("profile")}
            title="View Profile"
            style={{ textDecoration: "none", border: "none", background: "none", cursor: "pointer" }}
          >
            <div className="avatar">
              <Icon name="user" />
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name || "Staff"}</span>
              <span className="user-role">Staff</span>
            </div>
          </button>
          {showLogout && (
            <button
              className="icon-btn"
              id="logout-btn"
              title="Log Out"
              style={{ marginLeft: "10px", color: "#ef4444" }}
              aria-label="Log Out"
              onClick={() => {
                api.logout();
                navigate("login");
              }}
            >
              <Icon name="right-from-bracket" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Generic modal backdrop + card. */
export function Modal({ title, onClose, children }) {
  return (
    <div
      className="modal"
      style={{ display: "flex" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <span
            className="close-btn"
            aria-label="Close"
            onClick={onClose}
          >
            &times;
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Confirm / cancel dialog. */
export function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div
      className="modal-overlay"
      style={{ display: "flex" }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-card">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-outline" style={{ minWidth: "100px" }} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ minWidth: "100px" }} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline error message. */
export function ErrorMsg({ message }) {
  if (!message) return null;
  return (
    <p className="error-message" role="alert" style={{ display: "block" }}>
      {message}
    </p>
  );
}

/** Inline success message used after profile and password updates. */
export function SuccessMsg({ message }) {
  if (!message) return null;
  return (
    <p className="success-message" role="status" style={{ display: "block" }}>
      {message}
    </p>
  );
}

/** Confirmation / alert toast used across the staff app. */
export function Toast({ message, type, onDismiss, duration = 4000 }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeoutId);
  }, [duration, onDismiss]);

  const msgLower = (message || "").toLowerCase();
  const isError = type === "error" || msgLower.includes("unable") || msgLower.includes("failed") || msgLower.includes("error");
  const isWarning = type === "warning" || msgLower.includes("pending");
  const toastType = isError ? "error" : isWarning ? "warning" : type === "info" ? "info" : "success";

  const iconName =
    toastType === "error"
      ? "circle-exclamation"
      : toastType === "warning"
        ? "clock"
        : toastType === "info"
          ? "circle-info"
          : "circle-check";

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <div className={`toast-notification show ${toastType}`}>
        <Icon name={iconName} />
        <span className="toast-message">{message}</span>
        <button
          type="button"
          className="toast-dismiss"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          &times;
        </button>
      </div>
    </div>
  );
}
