import { useEffect, useState, useContext } from "react";
import { apiRequest } from "../../api/client.js";
import { AdminLayout } from "../../components/AdminLayout.jsx";
import { DataTable } from "../../components/DataTable.jsx";
import { Modal } from "../../components/Modal.jsx";
import { StatusBadge } from "../../components/StatusBadge.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";
import { ToastContext } from "../../context/ToastContext.jsx";
import { formatDate, money } from "../../utils/format.js";
import { createAction } from "../../../../app/actions.js";
import { RefundReceipt } from "../../../../app/RefundReceipt.jsx";
import { withRefundAmounts } from "../../utils/refundAmounts.js";

function isReviewOnly(ticket) {
  return ticket.raised_by_role === "manager" || ticket.decision === "payout_review";
}

export function FinanceDashboard() {
  const { profile, adminId } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [state, setState] = useState({
    noShows: [],
    refunds: [],
    payouts: [],
    pendingPayments: [],
    revenue: null,
    audit: [],
    analytics: null,
    recentPayments: [],
    topRestaurants: [],
  });
  const [filters, setFilters] = useState({
    dashboard: "",
    refunds: "",
    refundsStatus: "",
    pending: "",
    payouts: "",
    audit: "",
    auditStatus: "",
  });
  const [current, setCurrent] = useState(null);
  const [notes, setNotes] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);

  async function loadAll(auditStatus = filters.auditStatus) {
    const [
      refundsRes,
      payoutsRes,
      pendingRes,
      revenueRes,
      auditRes,
      analyticsRes,
      recentRes,
      topRes,
      noShowsRes,
    ] = await Promise.all([
      apiRequest("/finance/refunds", {}, "finance_admin"),
      apiRequest("/finance/payouts", {}, "finance_admin"),
      apiRequest("/finance/payouts/pending-payments", {}, "finance_admin"),
      apiRequest("/finance/revenue", {}, "finance_admin"),
      apiRequest("/finance/refund-audit", {}, "finance_admin"),
      apiRequest("/finance/analytics", {}, "finance_admin"),
      apiRequest("/finance/payments/recent?limit=10", {}, "finance_admin"),
      apiRequest("/finance/payments/top-restaurants?limit=5", {}, "finance_admin"),
      apiRequest("/finance/no-shows", {}, "finance_admin"),
    ]);
    setState({
      refunds: (refundsRes?.data || []).map((ticket) =>
        withRefundAmounts(ticket, auditRes?.data || []),
      ),
      noShows: noShowsRes?.data || [],
      payouts: payoutsRes?.data || [],
      pendingPayments: pendingRes?.data || [],
      revenue: revenueRes?.data || null,
      audit: (auditRes?.data || []).filter(
        (payment) => !auditStatus || payment.status === auditStatus,
      ),
      analytics: analyticsRes?.data || null,
      recentPayments: recentRes?.data || [],
      topRestaurants: topRes?.data || [],
    });
  }

  useEffect(() => {
    loadAll().catch((error) => showToast(error.message, "error"));
    const timer = setInterval(() => loadAll().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, []);

  function setFilter(key, value) {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
  }

  async function openRefund(id) {
    try {
      const res = await apiRequest(`/finance/refunds/${id}`, {}, "finance_admin");
      const audit = await apiRequest("/finance/refund-audit", {}, "finance_admin");
      setCurrent(withRefundAmounts(res.data, audit?.data || []));
      setNotes("");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function refundDecision(approve) {
    if (refundBusy) return;
    if (!notes.trim()) {
      showToast("Please add a note explaining your decision.", "error");
      return;
    }
    setRefundBusy(true);
    try {
      const res = await apiRequest(
        `/finance/refunds/${current.id}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify({ approve, notes: notes.trim(), admin_id: adminId }),
        },
        "finance_admin",
      );
      showToast(
        isReviewOnly(current)
          ? approve
            ? "Finance review resolved."
            : "Finance review closed."
          : approve
            ? `Refund approved${res?.data?.refunded_amount ? ` - ${money(res.data.refunded_amount)} refunded` : ""}.`
            : "Refund denied.",
      );
      setCurrent(null);
      await loadAll();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setRefundBusy(false);
    }
  }

  async function toggle(path, blocked, success) {
    try {
      await apiRequest(
        path,
        { method: "PATCH", body: JSON.stringify({ blocked, admin_id: adminId }) },
        "finance_admin",
      );
      showToast(success);
      await loadAll();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function settleAll() {
    try {
      const res = await apiRequest(
        "/finance/payouts/settle-all",
        { method: "POST", body: JSON.stringify({ admin_id: adminId }) },
        "finance_admin",
      );
      const summary = res?.data;
      showToast(
        summary
          ? `Settled ${summary.settled_count} payment(s) - ${money(summary.settled_amount)}${summary.blocked_count ? `, ${summary.blocked_count} blocked (skipped)` : ""}.`
          : "Settlement complete.",
      );
      await loadAll();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  return (
    <AdminLayout
      logoIcon="fa-sack-dollar"
      label="FINANCE TEAM"
      navItems={[
        { id: "dashboard", label: "Dashboard", icon: "fa-chart-line" },
        { id: "refunds", label: "Financial Requests", icon: "fa-money-bill-transfer" },
        { id: "payouts", label: "Restaurant Payouts", icon: "fa-store" },
        { id: "no-shows", label: "No-show Reviews", icon: "fa-user-clock" },
        { id: "audit", label: "Transaction Audit", icon: "fa-clock-rotate-left" },
      ]}
    >
      {(activeTab) => (
        <>
          {activeTab === "dashboard" && (
            <FinanceHome
              state={state}
              profile={profile}
              query={filters.dashboard}
              setQuery={(value) => setFilter("dashboard", value)}
            />
          )}
          {activeTab === "refunds" && (
            <Refunds
              refunds={state.refunds}
              query={filters.refunds}
              status={filters.refundsStatus}
              setQuery={(value) => setFilter("refunds", value)}
              setStatus={(value) => setFilter("refundsStatus", value)}
              openRefund={openRefund}
            />
          )}
          {activeTab === "payouts" && (
            <Payouts
              state={state}
              filters={filters}
              setFilter={setFilter}
              toggle={toggle}
              settleAll={settleAll}
              adminId={adminId}
              reload={loadAll}
              showToast={showToast}
            />
          )}
          {activeTab === "no-shows" && (
            <NoShowReviews
              cases={state.noShows}
              adminId={adminId}
              reload={loadAll}
              showToast={showToast}
            />
          )}
          {activeTab === "audit" && (
            <Audit audit={state.audit} filters={filters} setFilter={setFilter} reload={loadAll} />
          )}
          <RefundModal
            current={current}
            notes={notes}
            setNotes={setNotes}
            close={() => {
              if (!refundBusy) setCurrent(null);
            }}
            refundDecision={refundDecision}
            busy={refundBusy}
          />
        </>
      )}
    </AdminLayout>
  );
}

function NoShowReviews({ cases, adminId, reload, showToast }) {
  const [current, setCurrent] = useState(null),
    [notes, setNotes] = useState(""),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  function decide(decision) {
    run(async () => {
      if (notes.trim().length < 3) throw new Error("Explain the reason for your decision.");
      await apiRequest(
        `/finance/no-shows/${current.id}/decision`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision, notes: notes.trim(), admin_id: adminId }),
        },
        "finance_admin",
      );
      showToast("No-show decision recorded.");
      setCurrent(null);
      await reload();
    });
  }
  const rows = cases.filter((c) =>
    `${c.id} ${c.restaurant?.name} ${c.diner?.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h1>No-show reviews</h1>
          <p>Payments stay held until finance completes its review.</p>
        </div>
        <button className="btn-sm" onClick={() => run(reload)} disabled={busy}>
          Refresh
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="filter-bar">
        <input
          aria-label="Search no-show reviews"
          placeholder="Find diner, restaurant, or reservation…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <DataTable
        columns={[
          { key: "r", label: "Reservation" },
          { key: "d", label: "Diner / restaurant" },
          { key: "m", label: "Held amount" },
          { key: "s", label: "Review state" },
          { key: "a", label: "Action" },
        ]}
        rows={rows.map((c) => (
          <tr key={c.id}>
            <td>
              {c.id}
              <div>{formatDate(c.no_show_at || c.created_at, true)}</div>
            </td>
            <td>
              {c.diner?.name}
              <div>{c.restaurant?.name}</div>
            </td>
            <td>{money(c.payment?.amount)}</td>
            <td>
              {c.no_show_review
                ? c.no_show_review.decision.replaceAll("_", " ")
                : c.overdue
                  ? "Overdue · more than 24 hours"
                  : "Awaiting review"}
            </td>
            <td>
              <button
                className="btn-sm"
                onClick={() => {
                  setCurrent(c);
                  setNotes("");
                  setError("");
                }}
              >
                {c.no_show_review ? "View decision" : "Review case"}
              </button>
            </td>
          </tr>
        ))}
        emptyText="No no-show cases."
      />
      {current && (
        <Modal open>
          <h2>No-show review · {current.id}</h2>
          <div className="detail-section">
            <p>
              {current.diner?.name} · {current.restaurant?.name}
            </p>
            <p>
              Service: {current.slot?.slot_date} · {current.slot?.start_time}–
              {current.slot?.end_time}
            </p>
            <p>
              Grace period: {current.booking_terms?.no_show_grace_minutes ?? "Original terms"}{" "}
              minutes
            </p>
            <p>
              Check-in:{" "}
              {current.checkin
                ? formatDate(current.checkin.checkin_time, true)
                : "No check-in recorded"}
            </p>
            <p>
              {current.booking_terms?.no_show_policy ||
                "Legacy booking: review its original terms before deciding."}
            </p>
            <p>{current.disputes?.length || 0} linked support ticket(s)</p>
            {current.disputes?.map((t) => (
              <p key={t.id}>
                {t.subject} · {t.status} · {t.description}
              </p>
            ))}
            <p>
              Deposit {money(current.payment?.deposit_amount)} · total paid{" "}
              {money(current.payment?.amount)}
            </p>
          </div>
          {current.no_show_review ? (
            <p>
              Decision: {current.no_show_review.decision} · {current.no_show_review.notes}
              <br />
              {formatDate(current.no_show_review.at, true)} · {current.no_show_review.actor_id}
            </p>
          ) : (
            <>
              <label>
                Decision notes
                <textarea
                  aria-label="No-show decision notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="3"
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <div className="modal-actions">
                <button
                  className="btn-sm"
                  disabled={busy || !current.payment}
                  onClick={() => decide("release")}
                >
                  Release restaurant share
                </button>
                <button
                  className="btn-sm"
                  disabled={busy || !current.payment}
                  onClick={() => decide("refund_deposit")}
                >
                  Refund deposit
                </button>
                <button
                  className="btn-sm danger"
                  disabled={busy || !current.payment}
                  onClick={() => decide("refund_full")}
                >
                  Full refund · restaurant failure
                </button>
              </div>
            </>
          )}
          <div className="modal-actions">
            <button className="btn-sm" disabled={busy} onClick={() => setCurrent(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function FinanceHome({ state, profile, query, setQuery }) {
  const recent = state.recentPayments.filter(
    (p) =>
      !query ||
      (p.payment_id || "").toLowerCase().includes(query.toLowerCase()) ||
      (p.restaurant_name || "").toLowerCase().includes(query.toLowerCase()) ||
      (p.diner_name || "").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h1>Finance Dashboard</h1>
          <p>Welcome back, {profile.name || "agent"}.</p>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeftColor: "#1565C0" }}>
          <h4>Total Paid by Diners</h4>
          <p className="value">{money(state.revenue?.total_paid_by_diners)}</p>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#2E7D32" }}>
          <h4>Total Platform Revenue</h4>
          <p className="value">{money(state.revenue?.total_platform_revenue)}</p>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#00897B" }}>
          <h4>Total Payouts Paid</h4>
          <p className="value">{money(state.revenue?.total_payouts_settled)}</p>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#E65100" }}>
          <h4>Total Refunds Made</h4>
          <p className="value">
            {money(state.revenue?.total_refunded ?? state.revenue?.refunded_deposits)}
          </p>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#546E7A" }}>
          <h4>Finance Balance</h4>
          <p className="value">{money(state.revenue?.finance_balance)}</p>
          <p>Collections minus refunds and restaurant payouts.</p>
        </div>
      </div>
      <div className="analytics-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="analytics-tile">
          <h4>Total Restaurants</h4>
          <p className="value">{state.analytics?.total_restaurants ?? 0}</p>
        </div>
        <div className="analytics-tile">
          <h4>Total Bookings</h4>
          <p className="value">{state.analytics?.total_bookings ?? 0}</p>
        </div>
      </div>
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>Top Restaurants by Reservation Payments</h3>
        {state.topRestaurants.length ? (
          state.topRestaurants.map((r) => (
            <div key={r.restaurant_name} className="top-restaurant-row">
              <div>
                <div style={{ fontWeight: 700 }}>{r.restaurant_name || "-"}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {r.payment_count} payment(s)
                </div>
              </div>
              <div style={{ color: "#2E7D32", fontWeight: 800 }}>{money(r.total_paid)}</div>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No payments yet.</p>
        )}
      </div>
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: "1.1rem" }}>Recent Reservation Payments</h1>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-input-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by restaurant, diner, or payment id..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <DataTable
        columns={[
          { key: "p", label: "Payment" },
          { key: "d", label: "Diner" },
          { key: "r", label: "Restaurant" },
          { key: "a", label: "Amount" },
          { key: "s", label: "Status" },
          { key: "w", label: "When" },
        ]}
        rows={recent.map((p) => (
          <tr key={p.payment_id}>
            <td>{p.payment_id}</td>
            <td>{p.diner_name || "-"}</td>
            <td>{p.restaurant_name || "-"}</td>
            <td>{money(p.amount)}</td>
            <td>
              <StatusBadge status={p.status} />
            </td>
            <td>{formatDate(p.payment_time)}</td>
          </tr>
        ))}
        emptyText="No payments found."
      />
    </section>
  );
}

function Refunds({ refunds, query, status, setQuery, setStatus, openRefund }) {
  const rows = refunds.filter((ticket) => {
    const refundStatus = ticket.settled ? "settled" : "pending";
    return (
      (!status || refundStatus === status) &&
      (!query ||
        (ticket.id || "").toLowerCase().includes(query.toLowerCase()) ||
        (ticket.raised_by_user_id || "").toLowerCase().includes(query.toLowerCase()) ||
        (ticket.subject || "").toLowerCase().includes(query.toLowerCase()))
    );
  });
  return (
    <section className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h1>Financial Requests</h1>
          <p>Diner refund requests and manager payout reviews escalated by Customer Support.</p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-input-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by diner, ticket, or subject..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="settled">Settled</option>
        </select>
      </div>
      <DataTable
        columns={[
          { key: "t", label: "Ticket" },
          { key: "d", label: "Diner" },
          { key: "r", label: "Reservation" },
          { key: "dep", label: "Amount Paid" },
          { key: "refunded", label: "Refund Recorded" },
          { key: "sub", label: "Subject" },
          { key: "s", label: "Status" },
          { key: "a", label: "Action", style: { textAlign: "right" } },
        ]}
        rows={rows.map((ticket) => (
          <tr key={ticket.id}>
            <td>{ticket.id}</td>
            <td>{ticket.raised_by_user_id}</td>
            <td>{ticket.reservation?.id || ticket.linked_reservation_id || "-"}</td>
            <td>{money(ticket.total_paid_amount)}</td>
            <td>
              {ticket.refund ? (
                <>
                  {money(ticket.refund.amount)}
                  <div>{ticket.refund.id}</div>
                </>
              ) : (
                "-"
              )}
            </td>
            <td>{ticket.subject}</td>
            <td>
              <StatusBadge status={ticket.status} />
            </td>
            <td style={{ textAlign: "right" }}>
              <button className="btn-sm" onClick={() => openRefund(ticket.id)}>
                {ticket.settled ? "View" : "Review"}
              </button>
            </td>
          </tr>
        ))}
        emptyText="No refund requests found."
      />
    </section>
  );
}

function Payouts({ state, filters, setFilter, toggle, settleAll, adminId, reload, showToast }) {
  const pending = state.pendingPayments.filter(
    (p) =>
      !filters.pending ||
      (p.restaurant_name || "").toLowerCase().includes(filters.pending.toLowerCase()),
  );
  const payouts = state.payouts.filter(
    (p) =>
      !filters.payouts ||
      (p.restaurant_name || "").toLowerCase().includes(filters.payouts.toLowerCase()),
  );
  return (
    <section className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h1>Restaurant Payouts</h1>
          <p>
            Upcoming payments remain held. Only completed visits or finance-approved no-shows can
            release funds.
          </p>
        </div>
        <button className="btn-decision btn-approve" onClick={settleAll}>
          Retry eligible releases
        </button>
      </div>
      <div className="filter-bar">
        <div className="search-input-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by restaurant..."
            value={filters.pending}
            onChange={(event) => setFilter("pending", event.target.value)}
          />
        </div>
      </div>
      <DataTable
        columns={[
          { key: "p", label: "Payment" },
          { key: "r", label: "Restaurant" },
          { key: "n", label: "Net Amount" },
          { key: "paid", label: "Paid On" },
          { key: "auto", label: "Release state" },
          { key: "s", label: "Status" },
          { key: "a", label: "Action", style: { textAlign: "right" } },
        ]}
        rows={pending.map((p) => {
          const blocked = p.blocked || p.restaurant_blocked;
          return (
            <tr
              key={p.adjustment_id || p.payment_id}
              style={blocked ? { opacity: 0.6 } : undefined}
            >
              <td>
                {p.payment_id}
                {p.adjustment_id && (
                  <div>
                    {p.net_amount < 0 ? "Modification credit recovery" : "Modification credit"}
                  </div>
                )}
              </td>
              <td>
                {p.restaurant_name || "-"}{" "}
                {p.restaurant_blocked && (
                  <span className="badge badge-blocked">Restaurant Blocked</span>
                )}
              </td>
              <td>{money(p.net_amount)}</td>
              <td>{formatDate(p.payment_time, true)}</td>
              <td>{p.release_status?.replaceAll("_", " ") || "held"}</td>
              <td>
                <span className={`badge badge-${p.blocked ? "blocked" : "active"}`}>
                  {blocked ? "Blocked" : p.eligible ? "Eligible" : "Held"}
                </span>
                {p.release_attempts?.length > 0 && (
                  <details>
                    <summary>{p.release_attempts.length} release attempt(s)</summary>
                    {p.release_attempts.map((a, i) => (
                      <p key={i}>
                        {formatDate(a.at, true)} · {a.status} · {a.reason || a.actor_id}
                      </p>
                    ))}
                  </details>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <button
                  className={`btn-sm ${p.blocked ? "success" : "danger"}`}
                  onClick={() =>
                    toggle(
                      `/finance/payouts/payments/${p.payment_id}/block`,
                      !p.blocked,
                      p.blocked ? "Payment unblocked." : "Payment blocked from settlement.",
                    )
                  }
                >
                  {p.blocked ? "Unblock" : "Block"}
                </button>
                {p.eligible && !blocked && (
                  <button
                    className="btn-sm"
                    onClick={async () => {
                      try {
                        const res = await apiRequest(
                          `/finance/payouts/payments/${p.payment_id}/retry`,
                          { method: "POST", body: JSON.stringify({ admin_id: adminId }) },
                          "finance_admin",
                        );
                        showToast(`Release: ${res.data.release_status}`);
                        await reload();
                      } catch (e) {
                        showToast(e.message, "error");
                      }
                    }}
                  >
                    Retry release
                  </button>
                )}
              </td>
            </tr>
          );
        })}
        emptyText="No pending payments."
      />
      <div className="dashboard-header" style={{ marginTop: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.1rem" }}>Restaurant Summary</h1>
          <p>Already paid vs. yet to pay, per restaurant.</p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-input-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by restaurant..."
            value={filters.payouts}
            onChange={(event) => setFilter("payouts", event.target.value)}
          />
        </div>
      </div>
      <DataTable
        columns={[
          { key: "r", label: "Restaurant" },
          { key: "pr", label: "Pending Reservations" },
          { key: "pp", label: "Pending Payout" },
          { key: "sp", label: "Settled Payout" },
          { key: "status", label: "Payout Status" },
          { key: "a", label: "Action", style: { textAlign: "right" } },
        ]}
        rows={payouts.map((p) => (
          <tr key={p.restaurant_id}>
            <td>{p.restaurant_name}</td>
            <td>{p.pending_reservation_count}</td>
            <td>{money(p.pending_payout)}</td>
            <td>{money(p.settled_payout)}</td>
            <td>
              <span className={`badge badge-${p.payout_blocked ? "blocked" : "active"}`}>
                {p.payout_blocked ? "Blocked" : "Active"}
              </span>
            </td>
            <td style={{ textAlign: "right" }}>
              <button
                className={`btn-sm ${p.payout_blocked ? "success" : "danger"}`}
                onClick={() =>
                  toggle(
                    `/finance/payouts/${p.restaurant_id}/block`,
                    !p.payout_blocked,
                    p.payout_blocked
                      ? "Payouts unblocked for this restaurant."
                      : "Payouts blocked for this restaurant.",
                  )
                }
              >
                {p.payout_blocked ? "Unblock" : "Block"}
              </button>
            </td>
          </tr>
        ))}
        emptyText="No restaurants found."
      />
    </section>
  );
}

function Audit({ audit, filters, setFilter, reload }) {
  const rows = audit.filter(
    (a) =>
      !filters.audit ||
      (a.payment_id || "").toLowerCase().includes(filters.audit.toLowerCase()) ||
      (a.restaurant_name || "").toLowerCase().includes(filters.audit.toLowerCase()) ||
      (a.diner_name || "").toLowerCase().includes(filters.audit.toLowerCase()),
  );
  return (
    <section className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h1>Transaction Audit</h1>
          <p>Every reservation payment made by diners on the platform, in every status.</p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-input-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Search by diner, restaurant, or payment id..."
            value={filters.audit}
            onChange={(event) => setFilter("audit", event.target.value)}
          />
        </div>
        <select
          value={filters.auditStatus}
          onChange={(event) => {
            setFilter("auditStatus", event.target.value);
            reload(event.target.value);
          }}
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <DataTable
        columns={[
          { key: "p", label: "Payment" },
          { key: "res", label: "Reservation" },
          { key: "d", label: "Diner" },
          { key: "r", label: "Restaurant" },
          { key: "s", label: "Status" },
          { key: "a", label: "Amount" },
          { key: "ref", label: "Refunded" },
          { key: "refid", label: "Refund Reference" },
          { key: "set", label: "Settled" },
          { key: "by", label: "Settled By" },
          { key: "w", label: "When" },
        ]}
        rows={rows.map((a) => (
          <tr key={a.payment_id}>
            <td>{a.payment_id}</td>
            <td>{a.reservation_id}</td>
            <td>{a.diner_name || "-"}</td>
            <td>{a.restaurant_name || "-"}</td>
            <td>
              <StatusBadge status={a.status} />
            </td>
            <td>{money(a.amount)}</td>
            <td>{a.refunded_amount ? money(a.refunded_amount) : "-"}</td>
            <td>
              {a.refund_transactions?.length
                ? a.refund_transactions.map((refund) => (
                    <div key={refund.refund_id}>
                      {refund.refund_id} · {refund.ticket_id}
                      <br />
                      {money(refund.amount)} · {formatDate(refund.processed_at)} ·{" "}
                      {refund.processed_by}
                    </div>
                  ))
                : "-"}
            </td>
            <td>{a.settled_at ? formatDate(a.settled_at, true) : "-"}</td>
            <td>
              {a.settled_by === "auto"
                ? "Manager completion"
                : a.settled_by === "finance"
                  ? "Finance"
                  : "-"}
            </td>
            <td>{formatDate(a.payment_time)}</td>
          </tr>
        ))}
        emptyText="No transactions yet."
      />
    </section>
  );
}

function RefundModal({ current, notes, setNotes, close, refundDecision, busy }) {
  if (!current) return null;
  const reservation = current.reservation;
  const restaurant = current.restaurant;
  const payment = current.payment;
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
            {current.id} - {current.raised_by_role === "manager" ? "Manager" : "Diner"}{" "}
            {current.raised_by_user_id} - {formatDate(current.created_at)}
          </span>
        </div>
        <StatusBadge status={current.status} />
      </div>
      <div className="detail-section">
        <h4>Support Team's Notes</h4>
        <p style={{ margin: 0, fontSize: "0.87rem", whiteSpace: "pre-wrap" }}>
          {current.resolution_notes || "-"}
        </p>
      </div>
      {isReviewOnly(current) && (
        <p>
          This is a finance review. Record your finding here; this action does not automatically
          refund a diner or transfer funds.
        </p>
      )}
      {reservation ? (
        <div className="detail-section">
          <h4>
            <i className="fa-solid fa-calendar-check" /> Linked Reservation {reservation.id}
          </h4>
          <div className="detail-row">
            <span>Restaurant</span>
            <span>{restaurant?.name || reservation.restaurant_id}</span>
          </div>
          <div className="detail-row">
            <span>Guests</span>
            <span>{reservation.guest_count}</span>
          </div>
          <div className="detail-row">
            <span>Status</span>
            <span style={{ textTransform: "capitalize" }}>{reservation.reservation_status}</span>
          </div>
          {payment ? (
            <>
              <div className="detail-row">
                <span>Total Paid</span>
                <span>{money(current.total_paid_amount)}</span>
              </div>
              <div className="detail-row">
                <span>Diner Platform Fee</span>
                <span>{money(current.diner_platform_fee_amount)}</span>
              </div>
              <div className="detail-row">
                <span>Refundable amount (paid − platform fee)</span>
                <span>{money(current.refund_eligible_amount)}</span>
              </div>
              <div className="detail-row">
                <span>Already refunded for this reservation</span>
                <span>{money(current.already_refunded_amount)}</span>
              </div>
              <div className="detail-row">
                <span>Remaining to refund</span>
                <span>{money(current.refundable_amount)}</span>
              </div>
            </>
          ) : (
            <div className="detail-row">
              <span>No paid payment found for this reservation.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="detail-section">
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
            No reservation was linked to this ticket by Customer Support.
          </p>
        </div>
      )}
      <RefundReceipt refund={current.refund} />
      {!isReviewOnly(current) &&
        current.already_refunded_amount > 0 &&
        !current.refundable_amount && (
          <p role="status">
            The refundable amount for this reservation has already been returned. Another ticket
            cannot refund the same payment again.
          </p>
        )}
      {current.status === "escalated_finance_team" ? (
        <div className="detail-section">
          <h4>Decision</h4>
          <div className="form-group">
            <label>Notes (required)</label>
            <textarea
              rows="3"
              placeholder="Explain your decision..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn-decision btn-approve"
              disabled={busy || (!isReviewOnly(current) && !current.refundable_amount)}
              onClick={() => refundDecision(true)}
            >
              {isReviewOnly(current)
                ? "Mark Finance Review Resolved"
                : current.refundable_amount > 0
                  ? `Approve & Refund ${money(current.refundable_amount)}`
                  : current.already_refunded_amount > 0
                    ? "Already refunded"
                    : "No refundable balance"}
            </button>
            <button
              className="btn-decision btn-deny"
              disabled={busy}
              onClick={() => refundDecision(false)}
            >
              {isReviewOnly(current) ? "Close Finance Review" : "Deny Refund"}
            </button>
          </div>
        </div>
      ) : (
        <div className="detail-section">
          <h4>Outcome</h4>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>{current.resolution_notes || ""}</p>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-sm" disabled={busy} onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
}
