import { useState, useContext } from "react";
import ManagerSidebar from "../components/ManagerSidebar";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";

export default function StaffPage() {
  const { data, storage, refresh, navigate } = useContext(ManagerContext);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const staff = data?.staff || [];
  const filtered = staff.filter(
    (member) =>
      (!query || `${member.name} ${member.email}`.toLowerCase().includes(query.toLowerCase())) &&
      (!status || member.status === status),
  );
  const updateStatus = async (member, nextStatus) => {
    if (
      !window.confirm(
        `Are you sure you want to ${nextStatus === "Approved" ? "approve" : "reject"} this staff member?`,
      )
    )
      return;
    try {
      await storage.updateStaffStatus(member.id, nextStatus);
      refresh();
      showToast(
        nextStatus === "Approved" ? "Staff access approved!" : "Action completed.",
        nextStatus === "Approved" ? "success" : "info",
      );
    } catch (error) {
      showToast(error.message || "Unable to update staff access.", "error");
    }
  };
  const count = (value) => staff.filter((member) => member.status === value).length;
  return (
    <div className="app-container">
      <ManagerSidebar />
      <main className="main-content">
        <header className="top-header staff-header" style={{ height: 200, overflow: "visible" }}>
          <div
            className="header-overlay"
            style={{
              background: "linear-gradient(to right,rgba(0,0,0,0.8),rgba(0,0,0,0.4))",
            }}
          />
          <div className="header-content">
            <div className="header-title">
              <button className="back-btn" type="button" onClick={() => navigate("profile")}>
                <i className="ph ph-arrow-left" /> Back
              </button>
              <h2>Staff Management</h2>
              <p>Manage staff access requests and control restaurant staff permissions.</p>
            </div>
            <div className="header-actions">
              <div className="user-profile-widget">
                <div className="avatar-circle-small">
                  {data?.profile?.avatar ? (
                    <img src={data.profile.avatar} alt="Manager profile" />
                  ) : (
                    <i className="ph ph-user" />
                  )}
                </div>
                <div className="user-info">
                  <h4>{data?.profile?.name || "Manager"}</h4>
                  <span>Restaurant Manager</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="content-wrapper" style={{ marginTop: -40 }}>
          <div className="staff-stats">
            <div className="staff-stat-card">
              <div className="staff-stat-icon stat-icon-pending">
                <i className="ph ph-clock" />
              </div>
              <div className="staff-stat-info">
                <span className="staff-stat-label">Pending Requests</span>
                <span className="staff-stat-value">{count("Pending")}</span>
              </div>
            </div>
            <div className="staff-stat-card">
              <div className="staff-stat-icon stat-icon-approved">
                <i className="ph ph-check-circle" />
              </div>
              <div className="staff-stat-info">
                <span className="staff-stat-label">Approved Staff</span>
                <span className="staff-stat-value">{count("Approved")}</span>
              </div>
            </div>
            <div className="staff-stat-card">
              <div className="staff-stat-icon stat-icon-rejected">
                <i className="ph ph-x-circle" />
              </div>
              <div className="staff-stat-info">
                <span className="staff-stat-label">Rejected Requests</span>
                <span className="staff-stat-value">{count("Rejected")}</span>
              </div>
            </div>
          </div>
          <section className="card staff-filter-bar">
            <div className="search-bar">
              <i className="ph ph-magnifying-glass" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email..."
              />
            </div>
            <div className="dropdown-wrapper">
              <i className="ph ph-funnel" />
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All Statuses</option>
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
            </div>
            <span className="staff-count-label">
              Showing <strong>{filtered.length}</strong> requests
            </span>
          </section>
          <div className="staff-grid">
            {filtered.length ? (
              filtered.map((member) => (
                <article className="staff-card" key={member.id}>
                  <div className="staff-card-top">
                    <div className="staff-identity">
                      <div className="staff-avatar">{member.initials}</div>
                      <div>
                        <div className="staff-name">{member.name}</div>
                        <div className="staff-role">{member.role}</div>
                      </div>
                    </div>
                    <span className="staff-status-badge">
                      {member.status === "Pending" ? "Pending Approval" : member.status}
                    </span>
                  </div>
                  <div className="staff-card-meta">
                    <div className="staff-meta-row">
                      <i className="ph ph-envelope-simple" />
                      {member.email}
                    </div>
                    <div className="staff-meta-row">
                      <i className="ph ph-phone" />
                      {member.phone}
                    </div>
                    <div className="staff-meta-row">
                      <i className="ph ph-calendar-blank" />
                      Requested on {member.requestedOn}
                    </div>
                  </div>
                  <div className="staff-card-actions">
                    {member.status === "Pending" && (
                      <>
                        <button
                          className="btn btn-small btn-approve"
                          type="button"
                          onClick={() => updateStatus(member, "Approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-small btn-reject"
                          type="button"
                          onClick={() => updateStatus(member, "Rejected")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {member.status === "Approved" && (
                      <button
                        className="btn btn-small btn-revoke"
                        type="button"
                        onClick={() => updateStatus(member, "Rejected")}
                      >
                        Revoke Access
                      </button>
                    )}
                    {member.status === "Rejected" && (
                      <button
                        className="btn btn-small btn-approve"
                        type="button"
                        onClick={() => updateStatus(member, "Approved")}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">No staff records found.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
