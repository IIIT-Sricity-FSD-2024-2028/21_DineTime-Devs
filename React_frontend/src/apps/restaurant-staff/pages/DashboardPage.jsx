import { useState, useEffect, useContext } from "react";
import { StaffContext } from "../context/StaffContext.js";
import { ErrorMsg, Icon, Modal, TopNav } from "../components/StaffUI.jsx";
import { toIsoDate, tableStatusLabel } from "../utils/format.js";

export default function DashboardPage() {
  const { navigate, api, tables, slots, activeSlotId, loading, error } = useContext(StaffContext);
  const [currentDate, setCurrentDate] = useState(() => toIsoDate());
  const [slotId, setSlotId] = useState("");
  const [filter, setFilter] = useState("All");

  // Modal state
  const [editingTable, setEditingTable] = useState(null);
  const [newStatus, setNewStatus] = useState("Available");
  const [statusError, setStatusError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load data for the selected date
  useEffect(() => {
    api.refresh(currentDate, slotId);
  }, [currentDate, slotId]);

  const total = tables.length;
  const available = tables.filter((t) => t.computedStatus === "available").length;
  const reserved = tables.filter((t) => t.computedStatus === "reserved").length;
  const occupied = tables.filter((t) => t.computedStatus === "occupied").length;
  const blocked = tables.filter((t) => t.computedStatus === "blocked").length;
  const canChangeStatus = Boolean(
    editingTable &&
      !editingTable.scheduleBlocked &&
      ["available", "blocked"].includes(editingTable.computedStatus),
  );

  const filteredTables = tables.filter((t) => {
    if (filter === "All") return true;
    return tableStatusLabel(t.computedStatus) === filter;
  });

  const handleSaveStatus = async () => {
    if (!canChangeStatus || saving) return;
    const slotIds = editingTable.slotIds || [];
    if (slotIds.length === 0) {
      setStatusError("No time slots are configured for the selected date.");
      return;
    }
    setSaving(true);
    setStatusError("");
    try {
      await api.updateTableStatus(editingTable.id, slotIds, newStatus);
      await api.refresh(currentDate, slotId);
      setEditingTable(null);
    } catch (cause) {
      setStatusError(cause.message || "Unable to update this table.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopNav subtitle="Staff Dashboard" showLogout={false} />
      <div className="dashboard-container">
        <main className="main-content">
          {/* Header Section */}
          <section className="page-header">
            <div className="title-group">
              <h2>Table Status Management</h2>
              <p className="subtitle">
                Monitor and update restaurant table availability in real-time.
              </p>
            </div>
            <div className="header-controls">
              <label className="date-control">
                Service
                <select
                  aria-label="Staff service"
                  value={activeSlotId || ""}
                  onChange={(e) => setSlotId(e.target.value)}
                >
                  <option value="">Choose service</option>
                  {(slots || [])
                    .filter((s) => s.slot_date === currentDate)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="date-control" htmlFor="staff-date-selector">
                <span>Viewing Date</span>
                <input
                  type="date"
                  id="staff-date-selector"
                  value={currentDate}
                  onInput={(e) => setCurrentDate(e.currentTarget.value)}
                  onChange={(e) => setCurrentDate(e.target.value)}
                />
              </label>
              <button className="btn-orange" type="button" onClick={() => navigate("check-in")}>
                <Icon name="bars" /> Customer Check-In
              </button>
            </div>
          </section>

          <ErrorMsg message={error} />

          {/* Filters Section */}
          {/* Summary Cards */}
          <section className="summary-cards">
            <div className="card">
              <div className="card-dots" />
              <span className="card-label">Total Tables</span>
              <span className="card-val">{loading ? "-" : total}</span>
            </div>
            <div className="card">
              <div className="card-dots green" />
              <span className="card-label green">Available</span>
              <span className="card-val green">{loading ? "-" : available}</span>
            </div>
            <div className="card">
              <div className="card-dots orange" />
              <span className="card-label orange">Reserved</span>
              <span className="card-val orange">{loading ? "-" : reserved}</span>
            </div>
            <div className="card">
              <div className="card-dots red" />
              <span className="card-label red">Occupied</span>
              <span className="card-val red">{loading ? "-" : occupied}</span>
            </div>
            <div className="card">
              <div className="card-dots" />
              <span className="card-label">Blocked</span>
              <span className="card-val">{loading ? "-" : blocked}</span>
            </div>
          </section>

          <div className="legend-pills-outside">
            <span className="pill available">
              <span className="dot" /> Available
            </span>
            <span className="pill reserved">
              <span className="dot" /> Reserved
            </span>
            <span className="pill occupied">
              <span className="dot" /> Occupied
            </span>
            <span className="pill blocked">
              <span className="dot" /> Blocked
            </span>
          </div>

          {/* Floor Map Section */}
          <section className="floor-section-container">
            <div className="list-header">
              <div className="list-title">
                <h3>Restaurant Floor</h3>
                <span className="floor-date-label">
                  {new Date(`${currentDate}T00:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="floor-filters">
                {["All", "Available", "Reserved", "Occupied", "Blocked"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`filter-chip${filter === status ? " active" : ""}`}
                    onClick={() => setFilter(status)}
                  >
                    {status === "All" ? "All Tables" : status}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                Loading floor map...
              </div>
            ) : (
              <div className="table-grid" id="floor-map">
                {filteredTables.map((table) => {
                  const statusStr = tableStatusLabel(table.computedStatus);
                  const statusClass = statusStr.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={table.id}
                      className={`table-card ${statusClass}`}
                      onClick={() => {
                        setEditingTable(table);
                        setStatusError("");
                        setNewStatus(tableStatusLabel(table.computedStatus));
                      }}
                    >
                      <div className="table-header">
                        <span className="table-number">Table {table.table_number}</span>
                        <span className="table-seats">
                          <Icon name="users" /> {table.capacity} Seats
                        </span>
                      </div>
                      <div className="table-body">
                        <span className="table-status-label">{statusStr}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredTables.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1/-1",
                      padding: "20px",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No tables found for the selected filter.
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Status Edit Modal */}
      {editingTable && (
        <Modal title="Update Table Status" onClose={() => setEditingTable(null)}>
          <div>
            <div className="table-info-box">
              <div className="info-group">
                <span className="info-label">Table Number</span>
                <span className="info-val">Table {editingTable.table_number}</span>
              </div>
              <div className="info-group">
                <span className="info-label">Seats</span>
                <span className="info-val">{editingTable.capacity} Seats</span>
              </div>
              <div className="info-group" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                <span className="info-label">Current Status</span>
                <span className="info-val">{tableStatusLabel(editingTable.computedStatus)}</span>
              </div>
            </div>
            {editingTable.scheduleBlocked && (
              <p role="status">
                This table is blocked by the manager schedule. Ask the manager to remove that block.
              </p>
            )}
            {canChangeStatus && (
              <div className="form-group" style={{ marginTop: 24 }}>
                <label htmlFor="new-status-select">Select New Status</label>
                <select
                  id="new-status-select"
                  className="status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="Available">Available</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>
            )}
            {statusError && <ErrorMsg message={statusError} />}
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditingTable(null)}>
                Cancel
              </button>
              {canChangeStatus && (
                <button
                  className="btn-green"
                  onClick={handleSaveStatus}
                  disabled={saving || newStatus === tableStatusLabel(editingTable.computedStatus)}
                >
                  {saving ? "Updating..." : "Update Status"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
