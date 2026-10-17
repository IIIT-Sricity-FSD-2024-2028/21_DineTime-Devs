import { useState, useContext } from "react";
import managerApi from "../api/managerApi";
import { ManagerContext } from "../context/ManagerContext.jsx";

export default function ManagerHeader({ title, description, variant = "user", icon = "" }) {
  const { data, storage, refresh, navigate } = useContext(ManagerContext);
  const [open, setOpen] = useState(false);
  const notifications = data?.notifications || [];
  const restaurant = data?.restaurant || {};
  const unread = notifications.filter((notification) => !notification.read).length;
  const markRead = () => {
    storage.markAllNotificationsRead();
    refresh();
  };
  const logout = () => {
    managerApi.logout();
    navigate("login");
  };
  const profileName = data?.profile?.name || "Rahul Sharma";
  const profileAvatar = data?.profile?.avatar;
  const isProfileHeader = variant === "profile";
  const showActions = variant !== "none";

  return (
    <header className="top-header">
      <div className="header-overlay" />
      <div className="header-content">
        <div className={icon ? "header-title header-title-with-icon" : "header-title"}>
          {icon && (
            <div className="header-title-icon">
              <i className={`ph ${icon}`} />
            </div>
          )}
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {showActions && (
          <div className="header-actions">
            {isProfileHeader ? (
              <>
                <div className="notification-wrapper">
                  <button
                    className="icon-btn"
                    aria-label="Notifications"
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                  >
                    <i className="ph ph-bell" />
                    {unread > 0 && <span className="notification-badge">{unread}</span>}
                  </button>
                  {open && (
                    <div className="notification-dropdown show">
                      <div className="notification-header">
                        <h4>Notifications</h4>
                        <button className="mark-read-btn" type="button" onClick={markRead}>
                          Mark all as read
                        </button>
                      </div>
                      <div className="notification-list">
                        {notifications.length ? (
                          notifications.map((notification) => (
                            <div
                              className={`notification-item ${notification.read ? "" : "unread"}`}
                              key={notification.id}
                            >
                              <div className="notif-icon bg-orange-light">
                                <i className="ph ph-bell text-orange" />
                              </div>
                              <div className="notif-content">
                                <p>{notification.text || notification.desc}</p>
                                <span className="notif-time">{notification.time || ""}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="notification-item">
                            <p>No notifications yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button className="icon-btn" aria-label="Logout" type="button" onClick={logout}>
                  <i className="ph ph-sign-out" />
                </button>
              </>
            ) : (
              <div className="user-profile-widget">
                <div className="avatar-circle-small">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Manager profile" />
                  ) : (
                    <i className="ph ph-user" />
                  )}
                </div>
                <div className="user-info">
                  <h4>{profileName}</h4>
                  <span>{restaurant.name || data?.profile?.restaurantName || "Restaurant"}</span>
                  {restaurant.id && <small>Restaurant ID: {restaurant.id}</small>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
