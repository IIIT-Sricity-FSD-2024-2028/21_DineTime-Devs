import { createAction } from "../../../app/actions.js";
import { useState, useContext } from "react";
import { StaffContext } from "../context/StaffContext.js";
import { Icon, ErrorMsg, SuccessMsg, Toast } from "../components/StaffUI.jsx";

export default function ProfilePage() {
  const { navigate, user, api } = useContext(StaffContext);
  const [updateActionBusy, setUpdateActionBusy] = useState(false);
  const [updateActionError, setUpdateActionError] = useState("");
  const [updateActionRun] = useState(() => createAction(setUpdateActionBusy, setUpdateActionError));
  const updateAction = {
    busy: updateActionBusy,
    error: updateActionError,
    setError: setUpdateActionError,
    run: updateActionRun,
  };
  const [passwordActionBusy, setPasswordActionBusy] = useState(false);
  const [passwordActionError, setPasswordActionError] = useState("");
  const [passwordActionRun] = useState(() =>
    createAction(setPasswordActionBusy, setPasswordActionError),
  );
  const passwordAction = {
    busy: passwordActionBusy,
    error: passwordActionError,
    setError: setPasswordActionError,
    run: passwordActionRun,
  };

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [pwdData, setPwdData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [notifications, setNotifications] = useState(() => {
    const defaults = {
      "notif-email": true,
      "notif-sms": true,
      "notif-daily": false,
      "notif-manager": true,
    };
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => {
        const stored = sessionStorage.getItem(key);
        return [key, stored === null ? fallback : stored === "true"];
      }),
    );
  });

  const updateNotification = (key, checked) => {
    setNotifications((current) => ({ ...current, [key]: checked }));
    sessionStorage.setItem(key, String(checked));
  };

  const handleUpdateProfile = () => {
    updateAction.run(async () => {
      await api.updateProfile(formData);
      setEditMode(false);
    });
  };

  const handleChangePassword = () => {
    setPwdSuccess("");
    if (pwdData.new !== pwdData.confirm) {
      passwordAction.setError("New passwords do not match.");
      return;
    }
    passwordAction.run(async () => {
      await api.changePassword(pwdData.current, pwdData.new);
      setPwdData({ current: "", new: "", confirm: "" });
      setPwdSuccess("Password changed successfully.");
    });
  };

  return (
    <div className="profile-container" style={{ minHeight: "100vh", backgroundColor: "#fff4ea" }}>
      {/* Hero Header */}
      <header className="profile-hero">
        <div className="hero-inner">
          <div className="hero-left">
            <button className="back-btn" onClick={() => navigate("check-in")}>
              <Icon name="arrow-left" />
            </button>
            <div className="hero-title-group">
              <h1>Profile</h1>
              <p>Manage your staff account preferences and notifications</p>
            </div>
          </div>
          <div className="hero-right">
            <div className="hero-user">
              <div className="hero-user-info">
                <span className="hero-name">{user?.name}</span>
                <span className="hero-role">Staff</span>
              </div>
              <div className="hero-avatar">
                <Icon name="user" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="page-container">
        {/* Profile Information */}
        <section className="profile-card">
          <div className="card-heading">
            <div className="card-icon-wrap green">
              <Icon name="user" />
            </div>
            <h2>Profile Information</h2>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={formData.name}
                disabled={!editMode}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={formData.email}
                disabled={!editMode}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                disabled={!editMode}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, "") })
                }
              />
            </div>
          </div>

          <ErrorMsg message={updateAction.error} />

          <div className="card-actions">
            <button
              className="btn-outline"
              onClick={() => {
                if (editMode) {
                  setEditMode(false);
                  setFormData({
                    name: user?.name || "",
                    email: user?.email || "",
                    phone: user?.phone || "",
                  });
                } else {
                  setEditMode(true);
                }
              }}
            >
              <Icon name={editMode ? "xmark" : "pen"} /> {editMode ? "Cancel" : "Edit Profile"}
            </button>
            <button
              className="btn-orange"
              onClick={handleUpdateProfile}
              disabled={!editMode || updateAction.busy}
            >
              <Icon name="floppy-disk" /> {updateAction.busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        {/* Security */}
        <section className="profile-card">
          <div className="card-heading">
            <div className="card-icon-wrap green">
              <Icon name="lock" />
            </div>
            <h2>Security</h2>
          </div>

          <div className="form-col">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                value={pwdData.current}
                onChange={(e) => setPwdData({ ...pwdData, current: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={pwdData.new}
                onChange={(e) => setPwdData({ ...pwdData, new: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={pwdData.confirm}
                onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
              />
            </div>
          </div>

          <ErrorMsg message={passwordAction.error} />
          <SuccessMsg message={pwdSuccess} />

          <div className="card-actions">
            <button
              className="btn-green"
              onClick={handleChangePassword}
              disabled={passwordAction.busy}
            >
              {passwordAction.busy ? "Updating..." : "Change Password"}
            </button>
          </div>
        </section>

        <section className="profile-card">
          <div className="card-heading">
            <div className="card-icon-wrap green">
              <Icon name="bell" />
            </div>
            <h2>Notifications</h2>
          </div>
          <div className="toggle-list">
            {[
              [
                "notif-email",
                "Email Notifications for new reservations",
                "Receive email alerts when new reservations are made",
              ],
              [
                "notif-sms",
                "SMS alerts for customer check-ins",
                "Get text messages when customers arrive",
              ],
              [
                "notif-daily",
                "Daily reservation summary",
                "Daily email with reservation statistics",
              ],
              [
                "notif-manager",
                "Manager announcements",
                "Receive important updates from management",
              ],
            ].map(([key, label, description]) => (
              <div className="toggle-item" key={key}>
                <div className="toggle-info">
                  <span className="toggle-label">{label}</span>
                  <span className="toggle-desc">{description}</span>
                </div>
                <label className="toggle-switch" aria-label={label}>
                  <input
                    type="checkbox"
                    checked={notifications[key]}
                    onChange={(event) => updateNotification(key, event.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
