import { createAction } from "../../../app/actions.js";
import { useEffect, useState, useContext } from "react";
import { DinerLayout, Icon, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState, ErrorMessage, Modal } from "../components/Feedback.jsx";
import { LocationFields } from "../components/Fields.jsx";
import LocationMap from "../components/LocationMap.jsx";
import ReservationCard, { StatusBadge } from "../components/ReservationCard.jsx";
import { CancelDialog, ReviewDialog } from "../components/ReservationDialogs.jsx";
import { DinerContext } from "../context/DinerContext.js";

export default function ProfilePage() {
  const { api, user, reservations, restaurants, slots, notifications, navigate, params } =
    useContext(DinerContext);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [location, setLocation] = useState({
    address: user.address || "",
    city: user.city || "",
    country: user.country || "India",
    pincode: user.pincode || "",
    latitude: user.latitude,
    longitude: user.longitude,
  });
  useEffect(() => {
    setLocation({
      address: user.address || "",
      city: user.city || "",
      country: user.country || "India",
      pincode: user.pincode || "",
      latitude: user.latitude ?? 12.9716,
      longitude: user.longitude ?? 77.5946,
    });
  }, [user]);
  const [cancel, setCancel] = useState(null);
  const [review, setReview] = useState(
    reservations.find((item) => item.id === params.review) || null,
  );
  const [logout, setLogout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dineCompleteMessage, setDineCompleteMessage] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const upcoming = reservations.filter((item) =>
    ["reserved", "checked_in"].includes(item.reservation_status),
  );
  const history = reservations.filter(
    (item) => !["reserved", "checked_in"].includes(item.reservation_status),
  );

  function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    run(async () => {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Choose a JPG, PNG, or WebP image under 5 MB.");
      await api.uploadPhoto(file);
    });
    event.target.value = "";
  }

  function completeDine(reservation) {
    setDineCompleteMessage("");
    return run(async () => {
      const result = await api.completeDine(reservation.id);
      setDineCompleteMessage(
        result.payout_release === "released"
          ? "Dining completed. The restaurant payout was released immediately."
          : `Dining completed. Payout status: ${result.payout_release || "pending"}.`,
      );
      return result;
    });
  }

  return (
    <DinerLayout header={false}>
      <div className="hero-banner">
        <div className="hero-overlay" />
        <div className="hero-top-right">
          <div className="notification-wrapper">
            <button
              className="circle-icon"
              aria-label="Notifications"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Icon name="bell" />
            </button>
            {showNotifications && (
              <div className="dropdown-menu">
                <div className="dropdown-header">
                  <h3>Notifications</h3>
                  <button
                    className="btn-close-notif"
                    aria-label="Close notifications"
                    onClick={() => setShowNotifications(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="dropdown-body">
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <div className="notification-item" key={notification.id}>
                        <strong>{notification.type.replaceAll("_", " ")}</strong>
                        <p>{notification.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="empty-notif-msg">You have no new notifications</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <PageLink page="settings" className="circle-icon" aria-label="Profile settings">
            <Icon name="user" />
          </PageLink>
          <button className="circle-icon" aria-label="Log out" onClick={() => setLogout(true)}>
            <Icon name="arrow-right-from-bracket" />
          </button>
        </div>
        <div className="hero-titles">
          <h1>My Profile</h1>
          <p>Welcome back, {user.name?.split(" ")[0]}!</p>
        </div>
      </div>
      <div className="page-container">
        <ErrorMessage message={error} />
        {dineCompleteMessage && (
          <div className="diner-success" role="status">
            {dineCompleteMessage}
          </div>
        )}
        <div className="profile-card-large">
          <div className="profile-left">
            <div className="avatar-circle">
              {user.photo_url ? (
                <img src={api.asset(user.photo_url)} alt={user.name} />
              ) : (
                <Icon name="user" />
              )}
            </div>
            <h2 className="profile-name">{user.name}</h2>
            <div className="photo-actions">
              <button
                className="btn-green-solid"
                disabled={busy}
                onClick={(event) =>
                  event.currentTarget
                    .closest(".profile-left")
                    .querySelector('input[type="file"]')
                    .click()
                }
              >
                <Icon name="arrow-up-from-bracket" /> Upload Photo
              </button>
              {user.photo_url && (
                <button
                  className="btn-red-outline"
                  disabled={busy}
                  onClick={() => run(() => api.updateProfile({ photo_url: "" }))}
                >
                  <Icon name="trash" /> Remove Photo
                </button>
              )}
            </div>
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
            />
          </div>
          <div className="profile-right">
            {[
              ["EMAIL ADDRESS", user.email],
              ["PHONE NUMBER", user.phone],
              ["CITY", user.city],
              ["PINCODE", user.pincode],
              ["COUNTRY", user.country],
              [
                "MEMBER SINCE",
                user.created_at ? new Date(user.created_at).toLocaleDateString() : "—",
              ],
            ].map(([label, value]) => (
              <div className="info-group" key={label}>
                <div className="info-label">{label}</div>
                <div className="info-val">{value || "—"}</div>
              </div>
            ))}
          </div>
          <div className="profile-map-column">
            <div className="map-placeholder">
              <LocationMap
                latitude={user.latitude}
                longitude={user.longitude}
                interactive={false}
              />
              <div className="map-label">{user.address || user.city || "Set your location"}</div>
            </div>
            <button
              className="btn-orange-outline w-full mt-10"
              onClick={() => setEditingLocation(true)}
            >
              <Icon name="pen-to-square" /> Change Location
            </button>
          </div>
        </div>
        <h3 className="section-title">Upcoming Reservations</h3>
        <DataState>
          <div className="upcoming-list">
            {upcoming.map((reservation) => (
              <ReservationCard
                compact
                key={reservation.id}
                reservation={reservation}
                onCancel={setCancel}
                onDineComplete={completeDine}
                onReview={setReview}
              />
            ))}
            {!upcoming.length && (
              <EmptyState title="No upcoming reservations">
                <PageLink page="browse">Browse restaurants</PageLink>
              </EmptyState>
            )}
          </div>
          <h3 className="section-title">Reservation History</h3>
          <div className="table-card">
            <table className="history-table">
              <thead>
                <tr>
                  <th>RESTAURANT NAME</th>
                  <th>VISIT DATE</th>
                  <th>GUESTS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {history.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      {restaurants.find((item) => item.id === reservation.restaurant_id)?.name}
                    </td>
                    <td>{slots.find((item) => item.id === reservation.slot_id)?.slot_date}</td>
                    <td>{reservation.guest_count}</td>
                    <td>
                      <StatusBadge status={reservation.reservation_status} />
                    </td>
                    <td>
                      {reservation.reservation_status === "completed" &&
                      !reservation.diner_completed_at ? (
                        <button
                          className="btn-green-solid"
                          onClick={() => completeDine(reservation)}
                        >
                          Dine Complete
                        </button>
                      ) : reservation.reservation_status === "completed" ? (
                        <>
                          <button
                            className="btn-orange-outline"
                            onClick={() => setReview(reservation)}
                          >
                            Rate Experience
                          </button>
                        </>
                      ) : (
                        <PageLink page="details" params={{ id: reservation.id }}>
                          View Details
                        </PageLink>
                      )}
                    </td>
                  </tr>
                ))}
                {!history.length && (
                  <tr>
                    <td colSpan={5}>No reservation history yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>
      {editingLocation && (
        <Modal title="Change Location" onClose={() => setEditingLocation(false)}>
          <LocationMap
            latitude={location.latitude}
            longitude={location.longitude}
            onChange={(coordinates) => setLocation({ ...location, ...coordinates })}
          />
          <p className="map-caption">Click on the map or drag the pin to set your location.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                await api.updateProfile(location);
                setEditingLocation(false);
              });
            }}
          >
            <LocationFields value={location} onChange={setLocation} />
            <ErrorMessage message={error} />
            <button className="btn-green-solid w-full" disabled={busy}>
              Save Location
            </button>
          </form>
        </Modal>
      )}
      {logout && (
        <Modal title="Log Out" onClose={() => setLogout(false)}>
          <p>Are you sure you want to log out?</p>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setLogout(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                api.logout();
                navigate("login");
              }}
            >
              Log Out
            </button>
          </div>
        </Modal>
      )}
      {cancel && <CancelDialog reservation={cancel} onClose={() => setCancel(null)} />}
      {review && <ReviewDialog reservation={review} onClose={() => setReview(null)} />}
    </DinerLayout>
  );
}
