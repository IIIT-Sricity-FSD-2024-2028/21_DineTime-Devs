import { useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, assetUrl } from "../../api/client.js";
import { AdminLayout } from "../../components/AdminLayout.jsx";
import { DataTable } from "../../components/DataTable.jsx";
import { Modal } from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/StatusBadge.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { ToastContext } from "../../context/ToastContext.jsx";
import { formatDate } from "../../utils/format.js";

const statuses = [
  "open",
  "in_review",
  "escalated_finance_team",
  "escalated_super_admin",
  "resolved",
  "rejected",
];

export function SupportDashboard() {
  const { profile, adminId } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [tickets, setTickets] = useState([]);
  const [current, setCurrent] = useState(null);
  const [extra, setExtra] = useState(null);
  const [linked, setLinked] = useState(null);
  const [notes, setNotes] = useState("");
  const [dashboardSearchBy, setDashboardSearchBy] = useState("category");
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [dinerFilter, setDinerFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");

  async function loadTickets() {
    const res = await apiRequest("/support/tickets", {}, "support_admin");
    setTickets(res?.data || []);
  }

  useEffect(() => {
    loadTickets().catch((error) => showToast(error.message, "error"));
    const timer = setInterval(() => loadTickets().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === "open").length,
      review: tickets.filter((t) => t.status === "in_review").length,
      finance: tickets.filter((t) => t.status === "escalated_finance_team").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
    }),
    [tickets],
  );

  async function openTicket(id) {
    try {
      const res = await apiRequest(`/support/tickets/${id}`, {}, "support_admin");
      const ticket = res.data;
      setCurrent(ticket);
      setExtra(null);
      setLinked(null);
      setNotes("");
      const lookupPath =
        ticket.raised_by_role === "diner"
          ? `/support/lookup/diner/${ticket.raised_by_user_id}`
          : `/support/lookup/manager/${ticket.raised_by_user_id}`;
      const [lookup, reservation] = await Promise.all([
        apiRequest(lookupPath, {}, "support_admin").catch(() => null),
        ticket.linked_reservation_id
          ? apiRequest(
              `/support/lookup/reservation/${encodeURIComponent(ticket.linked_reservation_id)}`,
              {},
              "support_admin",
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      setExtra(lookup?.data || null);
      setLinked(reservation?.data || null);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function claimTicket() {
    try {
      await apiRequest(
        `/support/tickets/${current.id}/claim`,
        {
          method: "PATCH",
          body: JSON.stringify({ admin_id: adminId }),
        },
        "support_admin",
      );
      showToast("Ticket claimed for review.");
      await loadTickets();
      await openTicket(current.id);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function submitDecision(path, body, success) {
    if (!notes.trim()) {
      showToast(
        path.includes("reject")
          ? "Please add a note explaining the rejection."
          : "Please add a note explaining your decision.",
        "error",
      );
      return;
    }
    try {
      await apiRequest(
        `/support/tickets/${current.id}/${path}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
        "support_admin",
      );
      showToast(success);
      setCurrent(null);
      await loadTickets();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const sortedTickets = [...tickets].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const query = dashboardQuery.trim().toLowerCase();
  const matchingTickets = sortedTickets.filter((ticket) => {
    if (!query) return true;
    const value = {
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      ticketId: ticket.id,
    }[dashboardSearchBy];
    return String(value || "")
      .toLowerCase()
      .includes(query);
  });
  const recentRows = (query ? matchingTickets : matchingTickets.slice(0, 8)).map((ticket) =>
    ticketRow(ticket, openTicket),
  );
  const dinerRows = tickets
    .filter((t) => t.raised_by_role === "diner")
    .filter((t) => !dinerFilter || t.status === dinerFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((ticket) => ticketRow(ticket, openTicket, true));
  const managerRows = tickets
    .filter((t) => t.raised_by_role === "manager")
    .filter((t) => !managerFilter || t.status === managerFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((ticket) => ticketRow(ticket, openTicket, true, "manager"));

  return (
    <AdminLayout
      logoIcon="fa-headset"
      label="CUSTOMER SUPPORT"
      navItems={[
        { id: "dashboard", label: "Dashboard", icon: "fa-chart-line" },
        { id: "diner", label: "Diner Tickets", icon: "fa-user" },
        { id: "manager", label: "Manager Tickets", icon: "fa-store" },
      ]}
    >
      {(activeTab) => (
        <>
          {activeTab === "dashboard" && (
            <section className="dashboard-view">
              <div className="dashboard-header">
                <div>
                  <h1>Support Dashboard</h1>
                  <p>Welcome back, {profile.name || "agent"}.</p>
                </div>
              </div>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ borderLeftColor: "#E65100" }}>
                  <h4>Open</h4>
                  <p className="value">{counts.open}</p>
                </div>
                <div className="kpi-card" style={{ borderLeftColor: "#1565C0" }}>
                  <h4>In Review</h4>
                  <p className="value">{counts.review}</p>
                </div>
                <div className="kpi-card" style={{ borderLeftColor: "#6A1B9A" }}>
                  <h4>Escalated to Finance</h4>
                  <p className="value">{counts.finance}</p>
                </div>
                <div className="kpi-card" style={{ borderLeftColor: "#2E7D32" }}>
                  <h4>Resolved</h4>
                  <p className="value">{counts.resolved}</p>
                </div>
              </div>
              <div className="filter-bar">
                <select
                  aria-label="Search tickets by"
                  value={dashboardSearchBy}
                  onChange={(event) => setDashboardSearchBy(event.target.value)}
                >
                  <option value="category">Category</option>
                  <option value="subject">Subject</option>
                  <option value="status">Status</option>
                  <option value="ticketId">Ticket ID</option>
                </select>
                <div className="search-input-wrap">
                  <i className="fa-solid fa-magnifying-glass" />
                  <input
                    type="search"
                    aria-label={`Search by ${dashboardSearchBy === "ticketId" ? "ticket ID" : dashboardSearchBy}`}
                    placeholder={`Search by ${dashboardSearchBy === "ticketId" ? "ticket ID" : dashboardSearchBy}...`}
                    value={dashboardQuery}
                    onChange={(event) => setDashboardQuery(event.target.value)}
                  />
                </div>
              </div>
              <DataTable
                columns={ticketColumns}
                rows={recentRows}
                emptyText="No matching tickets."
              />
            </section>
          )}
          {activeTab === "diner" && (
            <TicketList
              title="Diner Tickets"
              subtitle="Issues raised directly by diners."
              filter={dinerFilter}
              setFilter={setDinerFilter}
              rows={dinerRows}
              empty="No diner tickets."
            />
          )}
          {activeTab === "manager" && (
            <TicketList
              title="Manager Tickets"
              subtitle="Issues raised by restaurant managers."
              filter={managerFilter}
              setFilter={setManagerFilter}
              rows={managerRows}
              empty="No manager tickets."
              manager
            />
          )}
          <TicketModal
            current={current}
            extra={extra}
            linked={linked}
            notes={notes}
            setNotes={setNotes}
            adminId={adminId}
            close={() => setCurrent(null)}
            claimTicket={claimTicket}
            submitDecision={(decision) =>
              submitDecision(
                "decision",
                { decision, notes: notes.trim(), admin_id: adminId },
                "Decision recorded.",
              )
            }
            resolveDirectly={() =>
              submitDecision(
                "resolve",
                { resolution_notes: notes.trim(), admin_id: adminId },
                "Ticket resolved.",
              )
            }
            rejectTicket={() =>
              submitDecision(
                "reject",
                { resolution_notes: notes.trim(), admin_id: adminId },
                "Ticket rejected.",
              )
            }
          />
        </>
      )}
    </AdminLayout>
  );
}

const ticketColumns = [
  { key: "ticket", label: "Ticket" },
  { key: "raised", label: "Raised By" },
  { key: "cat", label: "Category" },
  { key: "sub", label: "Subject" },
  { key: "status", label: "Status" },
  { key: "action", label: "Action", style: { textAlign: "right" } },
];

function ticketRow(ticket, openTicket, compact = false) {
  return (
    <tr key={ticket.id}>
      <td>{ticket.id}</td>
      <td>
        {compact
          ? ticket.raised_by_user_id
          : ticket.raised_by_role === "diner"
            ? "Diner"
            : "Manager"}{" "}
        {!compact && (
          <>
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              {ticket.raised_by_user_id}
            </span>
          </>
        )}
      </td>
      <td style={{ textTransform: "capitalize" }}>{ticket.category}</td>
      <td>{ticket.subject}</td>
      <td>
        <StatusBadge status={ticket.status} />
      </td>
      <td style={{ textAlign: "right" }}>
        <button className="btn-sm" onClick={() => openTicket(ticket.id)}>
          Open
        </button>
      </td>
    </tr>
  );
}

function TicketList({ title, subtitle, filter, setFilter, rows, empty, manager }) {
  return (
    <section className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="filter-bar">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status
                .replaceAll("_", " ")
                .replace("finance team", "Finance")
                .replace("super admin", "Super Admin")}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        columns={[
          { key: "ticket", label: "Ticket" },
          { key: "id", label: manager ? "Manager ID" : "Diner ID" },
          { key: "cat", label: "Category" },
          { key: "sub", label: "Subject" },
          { key: "status", label: "Status" },
          { key: "action", label: "Action", style: { textAlign: "right" } },
        ]}
        rows={rows}
        emptyText={empty}
      />
    </section>
  );
}

function TicketModal(props) {
  const {
    current,
    extra,
    linked,
    notes,
    setNotes,
    adminId,
    close,
    claimTicket,
    submitDecision,
    resolveDirectly,
    rejectTicket,
  } = props;
  if (!current) return null;

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
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.2rem" }}>{current.subject}</h2>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {current.id} - {current.raised_by_role === "diner" ? "Diner" : "Manager"}{" "}
            {current.raised_by_user_id} - {formatDate(current.created_at)}
          </span>
        </div>
        <StatusBadge status={current.status} />
      </div>
      <div className="detail-section">
        <h4>Description</h4>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.87rem", whiteSpace: "pre-wrap" }}>
          {current.description}
        </p>
        <Attachments attachments={current.attachments} />
      </div>
      {current.affected_staff_scope && (
        <div className="detail-section">
          <h4>Affected staff</h4>
          <p style={{ margin: 0 }}>
            {current.affected_staff_scope === "all"
              ? "All staff at the restaurant"
              : `${current.affected_staff_name || "Staff member"} (${current.affected_staff_id})`}
          </p>
        </div>
      )}
      {current.context_snapshot && (
        <details className="detail-section">
          <summary>Context when the ticket was raised</summary>
          {Object.entries(current.context_snapshot)
            .filter(([, value]) => value !== undefined && value !== null && value !== "")
            .map(([key, value]) => (
              <div className="detail-row" key={key}>
                <span>{key.replaceAll("_", " ")}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
        </details>
      )}
      {linked ? (
        <details open>
          <summary>Linked reservation</summary>
          <ReservationLookup data={linked} />
        </details>
      ) : current.linked_reservation_id ? (
        <div className="detail-section">
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Loading linked reservation...
          </p>
        </div>
      ) : null}
      {extra ? (
        current.raised_by_role === "diner" ? (
          <DinerHistory data={extra} />
        ) : (
          <ManagerHistory data={extra} />
        )
      ) : (
        <div className="detail-section">
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Loading raiser history...
          </p>
        </div>
      )}
      <ActionArea
        ticket={current}
        adminId={adminId}
        notes={notes}
        setNotes={setNotes}
        claimTicket={claimTicket}
        submitDecision={submitDecision}
        resolveDirectly={resolveDirectly}
        rejectTicket={rejectTicket}
      />
      <div className="modal-actions">
        <button className="btn-sm" onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function Attachments({ attachments }) {
  if (!attachments?.length)
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: 0 }}>No attachments.</p>
    );
  return attachments.map((url) => {
    const full = assetUrl(url);
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(url);
    return (
      <a key={url} className="attachment-chip" href={full} target="_blank" rel="noreferrer">
        {isImage ? <img src={full} alt="attachment" /> : <i className="fa-solid fa-file-pdf" />}{" "}
        {isImage ? "View" : "Document"}
      </a>
    );
  });
}

function ReservationLookup({ data }) {
  const { reservation, restaurant, diner, checkin, payments } = data;
  return (
    <div className="detail-section">
      <h4>
        <i className="fa-solid fa-calendar-check" /> Reservation {reservation.id}
      </h4>
      <div className="detail-row">
        <span>Status</span>
        <strong style={{ textTransform: "capitalize" }}>{reservation.reservation_status}</strong>
      </div>
      <div className="detail-row">
        <span>Restaurant</span>
        <span>{restaurant?.name || reservation.restaurant_id}</span>
      </div>
      <div className="detail-row">
        <span>Diner</span>
        <span>
          {diner?.name || reservation.user_id} ({diner?.email || ""})
        </span>
      </div>
      <div className="detail-row">
        <span>Guests</span>
        <span>{reservation.guest_count}</span>
      </div>
      <div className="detail-row">
        <span>Booked At</span>
        <span>{formatDate(reservation.created_at)}</span>
      </div>
      <div className="detail-row">
        <span>Checked In</span>
        <span>{checkin ? formatDate(checkin.checkin_time) : "Not checked in"}</span>
      </div>
      <div className="detail-row">
        <span>Payments</span>
        <span>
          {(payments || []).map((p) => `${p.payment_status} - Rs.${p.amount}`).join(", ") ||
            "None recorded"}
        </span>
      </div>
    </div>
  );
}

function DinerHistory({ data }) {
  const rows = data.reservations.slice(0, 8);
  return (
    <div className="detail-section">
      <h4>
        <i className="fa-solid fa-user" /> Diner: {data.diner.name}
      </h4>
      <div className="detail-row">
        <span>Email</span>
        <span>{data.diner.email}</span>
      </div>
      <div className="detail-row">
        <span>Phone</span>
        <span>{data.diner.phone || "-"}</span>
      </div>
      <div className="detail-row">
        <span>Loyalty Points</span>
        <span>{data.dinerDetails?.loyalty_points ?? "-"}</span>
      </div>
      <h4 style={{ marginTop: "0.8rem" }}>Reservation History ({data.reservations.length})</h4>
      {rows.length ? (
        rows.map((r) => (
          <div key={r.id} className="detail-row">
            <span>
              {r.id} - {r.restaurant_id}
            </span>
            <span style={{ textTransform: "capitalize" }}>{r.reservation_status}</span>
          </div>
        ))
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No reservations found.</p>
      )}
    </div>
  );
}

function ManagerHistory({ data }) {
  return (
    <div className="detail-section">
      <h4>
        <i className="fa-solid fa-store" /> Manager: {data.manager.name}
      </h4>
      <div className="detail-row">
        <span>Email</span>
        <span>{data.manager.email}</span>
      </div>
      <div className="detail-row">
        <span>Phone</span>
        <span>{data.manager.phone || "-"}</span>
      </div>
      <h4 style={{ marginTop: "0.8rem" }}>Restaurant(s)</h4>
      {data.restaurants.length ? (
        data.restaurants.map((r) => (
          <div key={r.id} className="detail-row">
            <span>
              {r.name} ({r.id})
            </span>
            <span>{r.status}</span>
          </div>
        ))
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No restaurants found.</p>
      )}
      <div className="detail-row">
        <span>Total / Completed / Cancelled / No-Show</span>
        <span>
          {data.stats.total} / {data.stats.completed} / {data.stats.cancelled} /{" "}
          {data.stats.no_show}
        </span>
      </div>
    </div>
  );
}

function ActionArea({
  ticket,
  adminId,
  notes,
  setNotes,
  claimTicket,
  submitDecision,
  resolveDirectly,
  rejectTicket,
}) {
  if (ticket.status === "resolved" || ticket.status === "rejected")
    return (
      <div className="detail-section">
        <h4>Outcome</h4>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>{ticket.resolution_notes || ""}</p>
      </div>
    );
  if (ticket.status === "escalated_finance_team")
    return (
      <div className="detail-section">
        <h4>Escalated to Finance Team</h4>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          {ticket.decision === "refund_approved"
            ? "Refund approved and awaiting the finance team."
            : "Sent to the finance team for review."}{" "}
          No further action needed from Customer Support.
        </p>
      </div>
    );
  if (ticket.status === "escalated_super_admin")
    return (
      <div className="detail-section">
        <h4>Escalated to Super Admin</h4>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          This ticket is locked while the Super Admin reviews it.
        </p>
      </div>
    );
  if (ticket.assigned_admin_id && ticket.assigned_admin_id !== adminId)
    return (
      <div className="detail-section">
        <h4>In Review</h4>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          Another support agent is reviewing this ticket.
        </p>
      </div>
    );
  return (
    <div className="detail-section">
      <h4>Decision</h4>
      {ticket.status === "open" && (
        <button className="btn-sm" onClick={claimTicket} style={{ marginBottom: "0.75rem" }}>
          Start Review
        </button>
      )}
      <div className="form-group">
        <label>Notes (required for any action)</label>
        <textarea
          rows="3"
          placeholder="Explain your finding..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
        {ticket.raised_by_role === "diner" && ticket.category === "refund" && (
          <>
            <button
              className="btn-decision btn-approve"
              disabled={ticket.status === "open"}
              onClick={() => submitDecision("refund_approved")}
            >
              Approve Refund -&gt; Finance
            </button>
            <button
              className="btn-decision btn-deny"
              disabled={ticket.status === "open"}
              onClick={() => submitDecision("refund_denied")}
            >
              Deny Refund
            </button>
          </>
        )}
        {ticket.raised_by_role === "manager" && ticket.category === "refund" && (
          <button
            className="btn-decision btn-approve"
            disabled={ticket.status === "open"}
            onClick={() => submitDecision("finance_review")}
          >
            Send Payout Issue to Finance
          </button>
        )}
        {ticket.category === "technical" && (
          <button
            className="btn-decision btn-escalate"
            disabled={ticket.status === "open"}
            onClick={() => submitDecision("escalated_technical")}
          >
            Escalate Technical Issue
          </button>
        )}
        {ticket.category === "other" && (
          <>
            <button
              className="btn-decision btn-approve"
              disabled={ticket.status === "open"}
              onClick={() => submitDecision("finance_review")}
            >
              Escalate to Finance Team
            </button>
            <button
              className="btn-decision btn-escalate"
              disabled={ticket.status === "open"}
              onClick={() => submitDecision("escalated_technical")}
            >
              Escalate to Technical Team
            </button>
          </>
        )}
        <button
          className="btn-decision btn-resolve"
          disabled={ticket.status === "open"}
          onClick={resolveDirectly}
        >
          Resolve Directly
        </button>
        <button className="btn-sm" disabled={ticket.status === "open"} onClick={rejectTicket}>
          Reject
        </button>
      </div>
    </div>
  );
}
