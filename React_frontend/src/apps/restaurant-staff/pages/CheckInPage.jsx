import { indiaTime } from "../../../app/indiaTime.js";
import { useEffect, useState, useContext } from "react";
import { StaffContext } from "../context/StaffContext.js";
import { ConfirmModal, ErrorMsg, Icon, Modal, Toast, TopNav } from "../components/StaffUI.jsx";
import { timeLabel, toIsoDate } from "../utils/format.js";

const emptyWalkIn = { name: "", phone: "", guests: "2", time: "", tableId: "" };

function currentTime() {
  return indiaTime();
}

export default function CheckInPage() {
  const { navigate, api, reservations, allTables, loading, error } = useContext(StaffContext);
  const [currentDate, setCurrentDate] = useState(() => toIsoDate());
  const [timeFilter, setTimeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [walkinData, setWalkinData] = useState(emptyWalkIn);

  useEffect(() => {
    api.refresh(currentDate);
    const timer = window.setInterval(() => api.refresh(currentDate), 15000);
    return () => window.clearInterval(timer);
  }, [api, currentDate]);

  const dateReservations = reservations.filter((booking) => booking.date === currentDate);

  const filteredReservations = (() => {
    const query = search.trim().toLowerCase();
    return dateReservations.filter((booking) => {
      const matchesSearch =
        !query ||
        (booking.userName || "").toLowerCase().includes(query) ||
        (booking.id || "").toLowerCase().includes(query);
      const matchesTime = !timeFilter || booking.time?.startsWith(timeFilter);
      return matchesSearch && matchesTime;
    });
  })();

  const stats = {
    total: dateReservations.length,
    verified: dateReservations.filter((booking) => booking.statusLabel === "Checked-In").length,
    pending: dateReservations.filter((booking) => booking.statusLabel === "Upcoming").length,
    noShow: dateReservations.filter((booking) => booking.statusLabel === "No-Show").length,
  };

  async function updateStatus(reservationId, status) {
    try {
      await api.updateReservationStatus(reservationId, status);
      await api.refresh(currentDate);
      setToastMsg(
        status === "Checked-In"
          ? "Customer checked in successfully."
          : `Customer marked as ${status}.`,
      );
    } catch (cause) {
      setToastMsg(cause.message || "Unable to update reservation status.");
    }
  }

  async function handleWalkInSubmit(event) {
    event.preventDefault();
    try {
      await api.createWalkIn({
        name: walkinData.name.trim(),
        phone: walkinData.phone,
        guestCount: walkinData.guests,
        tableId: walkinData.tableId,
        time: walkinData.time,
      });
      setShowWalkIn(false);
      setWalkinData(emptyWalkIn);
      await api.refresh(currentDate);
      setToastMsg("Walk-in checked in successfully!");
    } catch (cause) {
      setToastMsg(cause.message || "Unable to check in this walk-in.");
    }
  }

  const restaurantId = api.session?.user?.restaurantId;
  const restaurantTables = allTables
    .filter((table) => !restaurantId || table.restaurant_id === restaurantId)
    .sort((left, right) => Number(left.table_number) - Number(right.table_number));

  return (
    <>
      <TopNav showNotifications onNotifications={() => setShowNotifications(true)} />
      <div className="dashboard-container">
        <main className="main-content">
          <section className="page-header">
            <h2>Customer Check-In</h2>
            <div className="header-actions">
              <button
                className="btn-orange"
                type="button"
                onClick={() => {
                  setWalkinData({ ...emptyWalkIn, time: currentTime() });
                  setShowWalkIn(true);
                }}
              >
                <Icon name="plus" /> New Check-In
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("dashboard")}>
                <Icon name="bars" /> Manage Tables
              </button>
            </div>
          </section>

          <ErrorMsg message={error} />

          <section className="filters-card">
            <div className="filter-group">
              <label htmlFor="filter-date">DATE</label>
              <div className="input-wrapper">
                <Icon name="calendar" className="fa-regular" />
                <input
                  id="filter-date"
                  type="date"
                  value={currentDate}
                  onInput={(event) => setCurrentDate(event.currentTarget.value)}
                  onChange={(event) => setCurrentDate(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="filter-group flex-fill">
              <label htmlFor="time-slot-input">TIME SLOT</label>
              <div className="input-wrapper">
                <Icon name="clock" className="fa-regular" />
                <input
                  id="time-slot-input"
                  type="time"
                  className="filter-input"
                  value={timeFilter}
                  onChange={(event) => setTimeFilter(event.target.value)}
                />
              </div>
            </div>
            <div className="filter-status">
              Showing results for{" "}
              <strong>{timeFilter ? timeLabel(timeFilter) : "All Times"}</strong>
            </div>
          </section>

          <section className="summary-cards">
            <div className="card">
              <div className="card-icon">
                <Icon name="user-group" />
              </div>
              <div className="card-info">
                <span className="card-val">{loading ? "-" : stats.total}</span>
                <span className="card-label">Total Reservations</span>
              </div>
            </div>
            <div className="card">
              <div className="card-icon green">
                <Icon name="circle-check" className="fa-regular" />
              </div>
              <div className="card-info">
                <span className="card-val green">{loading ? "-" : stats.verified}</span>
                <span className="card-label">Verified</span>
              </div>
            </div>
            <div className="card">
              <div className="card-icon orange">
                <Icon name="clock" className="fa-regular" />
              </div>
              <div className="card-info">
                <span className="card-val orange">{loading ? "-" : stats.pending}</span>
                <span className="card-label">Pending</span>
              </div>
            </div>
            <div className="card">
              <div className="card-icon red">
                <Icon name="circle-xmark" className="fa-regular" />
              </div>
              <div className="card-info">
                <span className="card-val red">{loading ? "-" : stats.noShow}</span>
                <span className="card-label">No Show</span>
              </div>
            </div>
          </section>

          <section className="list-header">
            <div className="list-title">
              <h3>Reservations</h3>
              <span className="badge">{filteredReservations.length} total</span>
            </div>
            <div className="list-actions">
              <div className="search-box">
                <Icon name="magnifying-glass" />
                <input
                  type="search"
                  placeholder="Search by ID or name..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="bookings-container" id="bookings-list">
            {filteredReservations.length === 0 && !loading && (
              <div
                className="booking-item"
                style={{ justifyContent: "center", color: "var(--text-muted)" }}
              >
                <div>
                  <Icon name="calendar-xmark" className="fa-regular" />{" "}
                  <span>No reservations found for the selected filters.</span>
                </div>
              </div>
            )}
            {filteredReservations.map((booking) => {
              const isExpanded = expandedId === booking.id;
              const isUpcoming = booking.statusLabel === "Upcoming";
              const isCheckedIn = booking.statusLabel === "Checked-In";
              const statusClass = isCheckedIn
                ? "checked-in"
                : booking.statusLabel === "No-Show"
                  ? "noshow"
                  : "upcoming";
              const initials = (booking.userName || "Guest")
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <article
                  key={booking.id}
                  className={`booking-item${isExpanded ? " expanded" : ""}`}
                >
                  <div className="customer-info" style={{ gridColumn: "1 / 2" }}>
                    <div className="customer-avatar">{initials}</div>
                    <div className="customer-details">
                      <h4>
                        {booking.userName}
                        <span className={`status-badge ${statusClass}`}>
                          • {isCheckedIn ? "Verified" : booking.statusLabel}
                        </span>
                        {isUpcoming && booking.no_show_eligible && (
                          <span
                            className="status-badge noshow"
                            title="Past the no-show grace period"
                          >
                            • Overdue
                          </span>
                        )}
                      </h4>
                      <span className="booking-id"># {booking.id}</span>
                    </div>
                  </div>

                  <div
                    className="action-buttons"
                    style={{ gridColumn: "3 / 4", justifySelf: "end" }}
                  >
                    <a
                      className="action-icon"
                      title="Contact Customer"
                      aria-label="Contact Customer"
                      href={
                        booking.userPhone && booking.userPhone !== "—"
                          ? `tel:${booking.userPhone}`
                          : undefined
                      }
                    >
                      <Icon name="phone" />
                    </a>
                    <button
                      type="button"
                      className={`action-icon view-btn${isExpanded ? " active" : ""}`}
                      title="View Details"
                      aria-label="View Details"
                      onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                    >
                      <Icon name="eye" className="fa-regular" />
                    </button>
                    {isUpcoming && (
                      <>
                        <button
                          type="button"
                          className="action-icon delete delete-btn"
                          title="Mark as No-Show"
                          aria-label="Mark as No-Show"
                          onClick={() => setConfirmAction({ booking, status: "No-Show" })}
                        >
                          <Icon name="user-xmark" />
                        </button>
                        <button
                          type="button"
                          className="btn-green check-in-btn"
                          onClick={() => setConfirmAction({ booking, status: "Checked-In" })}
                        >
                          <Icon name="circle-check" className="fa-regular" /> Check In
                        </button>
                      </>
                    )}
                    {isCheckedIn && (
                      <button type="button" className="btn-secondary" disabled>
                        <Icon name="circle-check" /> Verified
                      </button>
                    )}
                    {booking.statusLabel === "No-Show" && (
                      <button type="button" className="btn-secondary" disabled>
                        <Icon name="user-xmark" /> No-Show
                      </button>
                    )}
                  </div>

                  <div className="reservation-details" style={{ gridColumn: "1 / 4" }}>
                    <div className="detail-col">
                      <span className="detail-label">Reservation ID</span>
                      <span className="detail-value">{booking.id}</span>
                    </div>
                    <div className="detail-col">
                      <span className="detail-label">Time Slot</span>
                      <span className="detail-value">{timeLabel(booking.time)}</span>
                    </div>
                    <div className="detail-col">
                      <span className="detail-label">Party Size</span>
                      <span className="detail-value">{booking.guest_count} Guests</span>
                    </div>
                    <div className="detail-col">
                      <span className="detail-label">Table Assigned</span>
                      <span className="detail-value">{booking.tableLabel}</span>
                    </div>
                    <div className="detail-col">
                      <span className="detail-label">Contact</span>
                      <span className="detail-value">{booking.userPhone}</span>
                    </div>
                    <div className="detail-col">
                      <span className="detail-label">Status</span>
                      <span className="detail-value">{booking.statusLabel}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </main>
      </div>

      {showWalkIn && (
        <Modal title="Add New Walk-In" onClose={() => setShowWalkIn(false)}>
          <form id="add-walkin-form" onSubmit={handleWalkInSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="walkin-name">Customer Name</label>
                <input
                  id="walkin-name"
                  type="text"
                  placeholder="e.g. John Doe"
                  required
                  value={walkinData.name}
                  onChange={(event) => setWalkinData({ ...walkinData, name: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="walkin-phone">Phone Number</label>
                <input
                  id="walkin-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  required
                  value={walkinData.phone}
                  onChange={(event) =>
                    setWalkinData({ ...walkinData, phone: event.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="walkin-guests">Number of Guests</label>
                <input
                  id="walkin-guests"
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={walkinData.guests}
                  onChange={(event) => setWalkinData({ ...walkinData, guests: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="walkin-time">Arrival Time</label>
                <input
                  id="walkin-time"
                  type="time"
                  required
                  value={walkinData.time}
                  onChange={(event) => setWalkinData({ ...walkinData, time: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="walkin-table">Assign Table</label>
                <select
                  id="walkin-table"
                  required
                  value={walkinData.tableId}
                  onChange={(event) =>
                    setWalkinData({ ...walkinData, tableId: event.target.value })
                  }
                >
                  <option value="">Select Table...</option>
                  {restaurantTables
                    .filter((table) => Number(table.capacity) >= Number(walkinData.guests))
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        Table {table.table_number} ({table.capacity} Seater)
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowWalkIn(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-orange">
                Confirm &amp; Verify
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showNotifications && (
        <Modal title="Notifications" onClose={() => setShowNotifications(false)}>
          <div className="notification-body">
            <p>You have no new notifications</p>
          </div>
        </Modal>
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.status === "Checked-In" ? "Verify Check-In" : "Mark No-Show"}
          message={
            confirmAction.status === "Checked-In"
              ? `Customer: ${confirmAction.booking.userName}\nContact: ${confirmAction.booking.userPhone}\nGuests: ${confirmAction.booking.guest_count}\nAssigned: ${confirmAction.booking.tableLabel}\n\nProceed to check in this customer?`
              : `Mark ${confirmAction.booking.userName} as a No-Show for this reservation?`
          }
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const { booking, status } = confirmAction;
            setConfirmAction(null);
            void updateStatus(booking.id, status);
          }}
        />
      )}
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg("")} />}
    </>
  );
}
