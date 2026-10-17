import { useContext, useEffect, useState } from "react";
import { createAction } from "../../../app/actions.js";
import ManagerLayout from "../components/ManagerLayout.jsx";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";
const issues = [
  { code: "customer_dispute_no_show", label: "Customer dispute or no-show", category: "other" },
  { code: "staff_issue", label: "Staff-side issue", category: "other" },
  { code: "app_problem", label: "App problem", category: "technical" },
  { code: "other", label: "Something else", category: "other" },
  { code: "checkin_problem", label: "Check-in problem", category: "other" },
  { code: "payout_missing", label: "Payout not received", category: "refund" },
];
const statuses = {
  open: "Open",
  in_review: "In Review",
  escalated_finance_team: "With Finance",
  escalated_super_admin: "With Platform Admin",
  resolved: "Resolved",
  rejected: "Closed",
};
const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
const validIssue = (value) => (issues.some((item) => item.code === value) ? value : "");
export default function IssuesPage() {
  const { data, storage, ready, params } = useContext(ManagerContext),
    { showToast } = useContext(ToastContext);
  const [context, setContext] = useState({
    restaurants: [],
    staff: [],
    reservations: [],
    slots: [],
    payments: [],
  });
  const [tickets, setTickets] = useState([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [issue, setIssue] = useState(validIssue(params?.issue)),
    [reservationId, setReservationId] = useState(params?.reservation || "");
  const [staffSelection, setStaffSelection] = useState("");
  const [paymentId, setPaymentId] = useState(""),
    [query, setQuery] = useState(""),
    [note, setNote] = useState(""),
    [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const managerId = storage._getIds().managerId;
  useEffect(() => {
    setIssue(validIssue(params?.issue));
    setReservationId(params?.reservation || "");
    setStaffSelection("");
    setPaymentId("");
    setQuery("");
  }, [params?.issue, params?.reservation, params?.slot]);
  useEffect(() => {
    if (!ready || !managerId) return;
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const [details, mine] = await Promise.all([
          storage._request("/support/context", {
            headers: storage._headers(),
            signal: controller.signal,
          }),
          storage._request(`/support/tickets/mine?user_id=${encodeURIComponent(managerId)}`, {
            headers: storage._headers(),
            signal: controller.signal,
          }),
        ]);
        if (active) {
          setContext(details.data);
          setTickets(mine.data || []);
          setLoadError("");
        }
      } catch (cause) {
        if (active) setLoadError(cause.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 20000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [ready, managerId, storage]);
  const selected = issues.find((item) => item.code === issue);
  const needsReservation = ["customer_dispute_no_show", "checkin_problem"].includes(issue),
    isPayout = issue === "payout_missing",
    isStaffIssue = issue === "staff_issue";
  const restaurantStaff = context.staff?.length ? context.staff : data?.staff || [];
  const search = (value) =>
    String(value || "")
      .toLowerCase()
      .includes(query.toLowerCase());
  const reservations = context.reservations
    .filter((r) => search(`${r.diner_name} ${r.id} ${r.slot?.slot_date} ${r.slot?.start_time}`))
    .slice(0, 50);
  const payments = context.payments
    .filter((p) => search(`${p.id} ${p.reservation_id} ${p.payment_status}`))
    .slice(0, 50);
  function submit(event) {
    event.preventDefault();
    run(async () => {
      if (!selected) throw new Error("Choose an issue.");
      if (needsReservation && !reservationId) throw new Error("Choose the affected reservation.");
      if (isStaffIssue && !staffSelection)
        throw new Error("Choose all staff or a specific staff member.");
      if (["other", "staff_issue"].includes(issue) && !note.trim())
        throw new Error(
          issue === "other"
            ? "Add a short description for Something else."
            : "Describe the staff issue.",
        );
      const values = {
        raised_by_user_id: managerId,
        raised_by_role: "manager",
        restaurant_id: context.restaurants[0]?.id,
        issue_code: issue,
        issue_note: note.trim(),
        category: selected.category,
        subject: selected.label,
        description: note.trim() || selected.label,
        reservation_id: needsReservation ? reservationId : undefined,
        payment_id: isPayout ? paymentId : undefined,
        affected_staff_scope: isStaffIssue
          ? staffSelection === "all"
            ? "all"
            : "individual"
          : undefined,
        affected_staff_id: isStaffIssue && staffSelection !== "all" ? staffSelection : undefined,
      };
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value) body.append(key, value);
      });
      files.forEach((file) => body.append("attachments", file));
      await storage._request("/support/tickets", {
        method: "POST",
        headers: storage._authHeaders(),
        body,
      });
      const mine = await storage._request(
        `/support/tickets/mine?user_id=${encodeURIComponent(managerId)}`,
        { headers: storage._headers() },
      );
      setTickets(mine.data || []);
      setNote("");
      setFiles([]);
      showToast("Issue submitted with the relevant details attached.");
    });
  }
  return (
    <ManagerLayout
      title="Customer Support"
      description="Choose what went wrong. We attach your restaurant and the relevant records automatically."
      headerVariant="none"
    >
      <section className="card phase1-card manager-support-card">
        <div className="manager-support-heading">
          <div>
            <h3>How can we help?</h3>
            <p>
              {context.restaurants[0]?.name || "Your restaurant"}
              {context.restaurants[0]?.id && (
                <span>Restaurant ID: {context.restaurants[0].id}</span>
              )}
            </p>
          </div>
          <i className="ph ph-headset" aria-hidden="true" />
        </div>
        {loadError && (
          <p role="alert" className="phase1-error">
            {loadError}
          </p>
        )}
        <form onSubmit={submit} className="phase1-form manager-support-form">
          <fieldset className="phase1-fieldset" disabled={busy || loading}>
            <label className="manager-support-issue-label" htmlFor="manager-support-issue">
              What happened?
            </label>
            <select
              id="manager-support-issue"
              className="form-control"
              required
              value={issue}
              onChange={(event) => {
                setIssue(event.target.value);
                setReservationId("");
                setStaffSelection("");
                setPaymentId("");
                setQuery("");
                setError("");
              }}
            >
              <option value="">Select what happened</option>
              {issues.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            {isStaffIssue && (
              <section className="manager-support-dependent">
                <h4>Who is affected?</h4>
                <select
                  className="form-control"
                  required
                  value={staffSelection}
                  onChange={(event) => setStaffSelection(event.target.value)}
                >
                  <option value="">Select all staff or one staff member</option>
                  <option value="all">All staff</option>
                  {restaurantStaff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {member.email}
                    </option>
                  ))}
                </select>
                {!restaurantStaff.length && (
                  <p>No staff members are currently linked to your restaurant.</p>
                )}
              </section>
            )}
            {(needsReservation || isPayout) && (
              <section className="manager-support-dependent">
                <h4>{needsReservation ? "Which reservation?" : "Related payment (optional)"}</h4>
                <input
                  aria-label="Search related records"
                  placeholder={
                    needsReservation
                      ? "Search by diner, date or reservation ID"
                      : "Search by payment or reservation ID"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="phase1-record-options">
                  {isPayout && (
                    <button
                      type="button"
                      aria-pressed={!paymentId}
                      onClick={() => setPaymentId("")}
                    >
                      My restaurant payout account / not a specific payment
                    </button>
                  )}
                  {needsReservation &&
                    reservations.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        aria-pressed={reservationId === r.id}
                        onClick={() => setReservationId(r.id)}
                      >
                        <strong>{r.diner_name || "Diner"}</strong> · {r.slot?.slot_date}{" "}
                        {r.slot?.start_time?.slice(0, 5)} · {r.guest_count} guests · {r.id}
                      </button>
                    ))}
                  {isPayout &&
                    payments.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        aria-pressed={paymentId === p.id}
                        onClick={() => setPaymentId(p.id)}
                      >
                        {p.id} · {p.reservation_id} · {money(p.amount)} ·{" "}
                        {p.settled_at ? "Settled" : "Pending payout"}
                      </button>
                    ))}
                </div>
                {needsReservation && !reservations.length && (
                  <p>No matching reservations. Try another name or date.</p>
                )}
              </section>
            )}
            {selected && (
              <>
                <label>
                  {issue === "other"
                    ? "Briefly describe the issue"
                    : isStaffIssue
                      ? "Describe the staff issue"
                      : "Anything else we should know? (optional)"}
                  <textarea
                    maxLength={4000}
                    rows={3}
                    required={["other", "staff_issue"].includes(issue)}
                    placeholder="A short note is enough."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <label>
                  Screenshots or documents (optional)
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
                  />
                </label>
                {files.length > 0 && <p>{files.map((file) => file.name).join(", ")}</p>}
                <button
                  className="btn btn-primary-green"
                  disabled={
                    Boolean(loadError) ||
                    !selected ||
                    (needsReservation && !reservationId) ||
                    (isStaffIssue && !staffSelection)
                  }
                >
                  {busy ? "Submitting…" : "Submit Issue"}
                </button>
              </>
            )}
          </fieldset>
          {error && (
            <p className="phase1-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
      <section className="card">
        <h3>My Issues</h3>
        {loading ? (
          <p role="status">Loading issues…</p>
        ) : !tickets.length && !loadError ? (
          <p>No issues reported yet.</p>
        ) : (
          tickets.map((ticket) => (
            <article className="ticket-item" key={ticket.id}>
              <div className="ticket-item-head">
                <div>
                  <h4>{ticket.subject}</h4>
                  <p>
                    {ticket.id} ·{" "}
                    {new Date(ticket.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>
                </div>
                <span className={`status-pill status-${ticket.status}`}>
                  {statuses[ticket.status] || ticket.status}
                </span>
              </div>
              <p>
                {ticket.context_snapshot?.reservation_id ||
                  ticket.linked_reservation_id ||
                  ticket.linked_payment_id ||
                  ticket.linked_slot_id ||
                  "Restaurant issue"}
              </p>
              {ticket.affected_staff_scope && (
                <p>
                  Affected staff:{" "}
                  {ticket.affected_staff_scope === "all"
                    ? "All staff"
                    : context.staff.find((member) => member.id === ticket.affected_staff_id)
                        ?.name || ticket.affected_staff_id}
                </p>
              )}
              {ticket.issue_note && <p>{ticket.issue_note}</p>}
              {ticket.resolution_notes && (
                <p className="ticket-resolution">
                  <strong>Support:</strong> {ticket.resolution_notes}
                </p>
              )}
              {ticket.history?.length > 1 && (
                <details>
                  <summary>View activity</summary>
                  {ticket.history.map((event, index) => (
                    <p key={index}>
                      {new Date(event.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} ·{" "}
                      {statuses[event.status] || event.status}
                      {event.notes ? ` — ${event.notes}` : ""}
                    </p>
                  ))}
                </details>
              )}
            </article>
          ))
        )}
      </section>
    </ManagerLayout>
  );
}
