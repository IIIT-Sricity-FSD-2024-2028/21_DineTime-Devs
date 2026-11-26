import { useActions } from "../../../../store/hooks/useActions.js";
import { createVerificationActions } from "../../../../store/actions/verificationActions.js";
import { useEffect, useState, useContext } from "react";
import { assetUrl } from "../../api/client.js";
import { useApiRequest, useResource } from "../../../../store/hooks/useResource.js";
import { AdminLayout } from "../../components/AdminLayout.jsx";
import { DataTable } from "../../components/DataTable.jsx";
import { Modal } from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/StatusBadge.jsx";
import { useAuth } from "../../../../store/hooks/useAuth.js";
import { ToastContext } from "../../context/ToastContext.jsx";
import { formatDate } from "../../utils/format.js";

export function VerificationDashboard() {
  const apiRequest = useApiRequest();
  const actions = useActions(createVerificationActions);
  const { profile, adminId } = useAuth("sub-admin");
  const { showToast } = useContext(ToastContext);
  const query = useResource("/verification/applications", {
    pollingInterval: 20000,
    skipPollingIfUnfocused: true,
  });
  const applications = query.currentData || [];
  const loadApplications = () => query.refetch();
  const [currentId, setCurrentId] = useState(null);
  const detailQuery = useResource(`/verification/applications/${currentId}`, {
    skip: !currentId,
  });
  const current = detailQuery.currentData || null;
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (query.error) showToast(query.error.message, "error");
  }, [query.error]);

  const counts = {
    pending: applications.filter((item) => item.details.verification_status === "pending").length,
    approved: applications.filter((item) => item.details.verification_status === "approved").length,
    rejected: applications.filter((item) => item.details.verification_status === "rejected").length,
  };

  function openApplication(managerId) {
    setCurrentId(managerId);
    setReason("");
  }
  useEffect(() => {
    if (detailQuery.error) showToast(detailQuery.error.message, "error");
  }, [detailQuery.error]);

  async function submitReview(decision) {
    if (!current) return;
    if (decision === "rejected" && !reason.trim()) {
      showToast("Please provide a reason for rejecting this application.", "error");
      return;
    }
    try {
      await actions.review(current.manager.id, decision, reason, adminId);
      showToast(decision === "approved" ? "Application approved." : "Application rejected.");
      setCurrentId(null);
      await loadApplications();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const recentRows = [...applications]
    .sort((a, b) => b.manager.created_at.localeCompare(a.manager.created_at))
    .slice(0, 8)
    .map((item) => (
      <tr key={item.manager.id}>
        <td>
          {item.manager.name}
          <br />
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            {item.manager.email}
          </span>
        </td>
        <td>{item.restaurant?.name || "-"}</td>
        <td>{item.details.business_license_number}</td>
        <td>
          <StatusBadge status={item.details.verification_status} />
        </td>
        <td style={{ textAlign: "right" }}>
          <button className="btn-sm" onClick={() => openApplication(item.manager.id)}>
            Open
          </button>
        </td>
      </tr>
    ));

  const pendingRows = applications
    .filter((item) => item.details.verification_status === "pending")
    .sort((a, b) => a.manager.created_at.localeCompare(b.manager.created_at))
    .map((item) => (
      <tr key={item.manager.id}>
        <td>
          {item.manager.name}
          <br />
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            {item.manager.email}
          </span>
        </td>
        <td>{item.restaurant?.name || "-"}</td>
        <td>{item.details.business_license_number}</td>
        <td>{formatDate(item.manager.created_at)}</td>
        <td style={{ textAlign: "right" }}>
          <button className="btn-sm" onClick={() => openApplication(item.manager.id)}>
            Review
          </button>
        </td>
      </tr>
    ));

  return (
    <AdminLayout
      logoIcon="fa-clipboard-check"
      label="VERIFICATION TEAM"
      navItems={[
        { id: "dashboard", label: "Dashboard", icon: "fa-chart-line" },
        {
          id: "pending",
          label: "Pending Applications",
          icon: "fa-hourglass-half",
        },
      ]}
    >
      {(activeTab) => (
        <>
          {activeTab === "dashboard" && (
            <section className="dashboard-view">
              <div className="dashboard-header">
                <div>
                  <h1>Verification Dashboard</h1>
                  <p>Welcome back, {profile.name || "agent"}.</p>
                  <p style={{ fontSize: "0.72rem" }}>Location: {profile.location_id || "-"}</p>
                </div>
              </div>
              <div className="kpi-grid three">
                <div className="kpi-card" style={{ borderLeftColor: "#E65100" }}>
                  <h4>Pending</h4>
                  <p className="value">{counts.pending}</p>
                </div>
                <div className="kpi-card" style={{ borderLeftColor: "#2E7D32" }}>
                  <h4>Approved</h4>
                  <p className="value">{counts.approved}</p>
                </div>
                <div className="kpi-card" style={{ borderLeftColor: "#C62828" }}>
                  <h4>Rejected</h4>
                  <p className="value">{counts.rejected}</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "m", label: "Manager" },
                  { key: "r", label: "Restaurant" },
                  { key: "l", label: "License" },
                  { key: "s", label: "Status" },
                  { key: "a", label: "Action", style: { textAlign: "right" } },
                ]}
                rows={recentRows}
                emptyText="No applications yet."
              />
            </section>
          )}
          {activeTab === "pending" && (
            <section className="dashboard-view">
              <div className="dashboard-header">
                <div>
                  <h1>Pending Applications</h1>
                  <p>New restaurant manager sign-ups awaiting your review.</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "m", label: "Manager" },
                  { key: "r", label: "Restaurant" },
                  { key: "l", label: "License" },
                  { key: "d", label: "Submitted" },
                  { key: "a", label: "Action", style: { textAlign: "right" } },
                ]}
                rows={pendingRows}
                emptyText="No pending applications for your location."
              />
            </section>
          )}
          <ApplicationModal
            current={current}
            reason={reason}
            setReason={setReason}
            close={() => setCurrentId(null)}
            submitReview={submitReview}
          />
        </>
      )}
    </AdminLayout>
  );
}

function ApplicationModal({ current, close, reason, setReason, submitReview }) {
  if (!current) return null;
  const { manager, details, restaurant } = current;
  const isPending = details.verification_status === "pending";

  return (
    <Modal open>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid var(--border-light)",
          paddingBottom: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem" }}>{manager.name}</h2>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {manager.id} - Applied {formatDate(manager.created_at)}
          </span>
        </div>
        <StatusBadge status={details.verification_status} />
      </div>
      <div className="detail-section">
        <h4>Manager Details</h4>
        <div className="detail-row">
          <span>Email</span>
          <span>{manager.email}</span>
        </div>
        <div className="detail-row">
          <span>Phone</span>
          <span>{manager.phone || "-"}</span>
        </div>
        <div className="detail-row">
          <span>Business License</span>
          <span>{details.business_license_number}</span>
        </div>
      </div>
      <div className="detail-section">
        <h4>Restaurant</h4>
        <div className="detail-row">
          <span>Name</span>
          <span>{restaurant?.name || "-"}</span>
        </div>
        <div className="detail-row">
          <span>Cuisine</span>
          <span>{restaurant?.cuisine_type || "-"}</span>
        </div>
        <div className="detail-row">
          <span>Description</span>
          <span style={{ textAlign: "right", maxWidth: "60%" }}>
            {restaurant?.description || "-"}
          </span>
        </div>
      </div>
      <div className="detail-section">
        <h4>Verification Document</h4>
        {details.verification_document_url ? (
          <a
            className="doc-link"
            href={assetUrl(details.verification_document_url)}
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa-solid fa-file" /> View Document
          </a>
        ) : (
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontSize: "0.82rem",
            }}
          >
            No document on file.
          </p>
        )}
      </div>
      {isPending ? (
        <div className="detail-section">
          <h4>Decision</h4>
          <div className="form-group">
            <label>Rejection Reason (required only if rejecting)</label>
            <textarea
              rows="3"
              placeholder="Explain what needs to be fixed..."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn-decision btn-approve" onClick={() => submitReview("approved")}>
              Approve
            </button>
            <button className="btn-decision btn-reject" onClick={() => submitReview("rejected")}>
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-section">
          <h4>Outcome</h4>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            {details.rejection_reason || "No additional notes."}
          </p>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-sm" onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
}
