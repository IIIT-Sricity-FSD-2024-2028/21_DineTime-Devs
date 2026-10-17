import { createAction } from "../../../app/actions.js";
import { useEffect, useState, useContext } from "react";
import { DinerLayout, Hero, Icon, PageLink } from "../components/Navigation.jsx";
import { EmptyState, ErrorMessage } from "../components/Feedback.jsx";
import { DinerContext } from "../context/DinerContext.js";
import { timeLabel } from "../utils/format.js";
import TicketRefund from "../components/TicketRefund.jsx";

const issues = [
  {
    code: "payment_refund_issue",
    apiCode: "payment_problem",
    label: "Payment or refund issue",
    category: "refund",
  },
  {
    code: "reservation_issue",
    apiCode: "reservation_problem",
    label: "Reservation issue",
    category: "other",
  },
  {
    code: "checkin_seating_issue",
    apiCode: "checkin_problem",
    label: "Check-in or seating issue",
    category: "other",
  },
  {
    code: "restaurant_unavailable",
    apiCode: "reservation_problem",
    label: "Restaurant closed or unavailable",
    category: "other",
  },
  {
    code: "restaurant_experience",
    apiCode: "reservation_problem",
    label: "Restaurant experience, conduct, or safety concern",
    category: "other",
  },
  { code: "app_problem", label: "App problem", category: "technical" },
  { code: "other", apiCode: "other", label: "Something else", category: "other" },
];

export default function SupportPage() {
  const { api, user, params, reservations, restaurants, slots } = useContext(DinerContext);
  const [values, setValues] = useState({
    issue_code: "",
    reservation_id: params.reservation || "",
    description: "",
  });
  const [files, setFiles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const issue = issues.find((item) => item.code === values.issue_code);
  const needsReservation = issue ? !["app_problem", "other"].includes(values.issue_code) : false;
  useEffect(() => {
    let active = true;
    const loadTickets = () =>
      api
        .tickets()
        .then((data) => {
          if (active) setTickets(data);
        })
        .catch((cause) => {
          if (active) setError(cause.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    loadTickets();
    window.addEventListener("focus", loadTickets);
    const timer = window.setInterval(loadTickets, 20000);
    return () => {
      active = false;
      window.removeEventListener("focus", loadTickets);
      window.clearInterval(timer);
    };
  }, [api, user.id]);
  function attach(event) {
    const next = [...files, ...event.target.files];
    event.target.value = "";
    if (
      next.length > 5 ||
      next.some(
        (file) =>
          file.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      )
    ) {
      setError("Attach up to 5 JPG, PNG, WebP, or PDF files, up to 5 MB each.");
      return;
    }
    setError("");
    setFiles(next);
  }
  function submit(event) {
    event.preventDefault();
    run(async () => {
      if (!issue) throw new Error("Please select what happened before submitting your issue.");
      if (needsReservation && !values.reservation_id)
        throw new Error("Select the affected reservation.");
      if (!values.description.trim())
        throw new Error("Add a short note so our support team can help you.");
      const ticket = await api.createTicket(
        {
          issue_code: issue.code,
          issue_note: values.description.trim(),
          ...(values.reservation_id ? { reservation_id: values.reservation_id } : {}),
          category: issue.category,
          subject: issue.label,
          description: values.description.trim() || issue.label,
        },
        files,
      );
      setTickets((previous) => [ticket, ...previous]);
      setValues((previous) => ({ ...previous, description: "" }));
      setFiles([]);
      setSuccess(
        `Your issue has been submitted. Ticket ${ticket.id}. Our support team will review it.`,
      );
    });
  }
  return (
    <DinerLayout header={false}>
      <Hero
        settings
        title="Customer Support"
        subtitle="Report a refund issue, a problem with a restaurant, or a technical issue with the app."
      />
      <div className="settings-container">
        <div className="settings-card">
          <div className="card-header">
            <Icon name="headset" />
            <h3>Raise a New Issue</h3>
          </div>
          <p className="card-subtitle">
            Our support team reviews every ticket and will get back to you.
          </p>
          <div className="support-helper">
            <Icon name="circle-info" />
            <span>
              Choose what happened and the reservation. We'll include the booking details
              automatically. A short note or screenshot can help .
            </span>
          </div>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-group span-2">
                <label htmlFor="support-issue">What happened?</label>
                <select
                  id="support-issue"
                  className="form-control"
                  required
                  disabled={busy}
                  value={values.issue_code}
                  onChange={(event) => {
                    setValues({ ...values, issue_code: event.target.value });
                    setSuccess("");
                  }}
                >
                  <option value="">Select what happened</option>
                  {issues.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group span-2">
                <label htmlFor="support-reservation">
                  Which reservation?{!needsReservation && " (optional)"}
                </label>
                <select
                  id="support-reservation"
                  className="form-control"
                  required={needsReservation}
                  disabled={busy}
                  value={values.reservation_id}
                  onChange={(event) => setValues({ ...values, reservation_id: event.target.value })}
                >
                  <option value="">
                    {needsReservation ? "Select a reservation" : "Not about a reservation"}
                  </option>
                  {[...reservations]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((reservation) => {
                      const restaurant = restaurants.find(
                        (item) => item.id === reservation.restaurant_id,
                      );
                      const slot = slots.find((item) => item.id === reservation.slot_id);
                      return (
                        <option key={reservation.id} value={reservation.id}>
                          {restaurant?.name || "Restaurant"} · {slot?.slot_date || slot?.date || ""}{" "}
                          {timeLabel(slot?.start_time)} · {reservation.id}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div className="form-group span-2">
                <label htmlFor="support-description">Add a short note (required)</label>
                <textarea
                  id="support-description"
                  className="form-control"
                  rows={3}
                  placeholder="Anything else we should know?"
                  required
                  disabled={busy}
                  maxLength={4000}
                  value={values.description}
                  onChange={(event) => setValues({ ...values, description: event.target.value })}
                />
              </div>
              <div className="form-group span-2">
                <label htmlFor="support-files">Attach Photos or Documents (optional)</label>
                <label className="file-input-wrap" htmlFor="support-files">
                  <Icon name="paperclip" /> Click to attach up to 5 files (images or PDF, 5MB each)
                  <input
                    id="support-files"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={attach}
                  />
                </label>
                <div className="file-chip-list">
                  {files.map((file, index) => (
                    <span className="file-chip" key={`${file.name}-${index}`}>
                      {file.name}
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles(files.filter((_, position) => position !== index))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <ErrorMessage message={error} />
            {success && (
              <p className="diner-success" role="status">
                {success}
              </p>
            )}
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy || !issue}>
                <Icon name="paper-plane" /> {busy ? "Submitting…" : "Submit Issue"}
              </button>
            </div>
          </form>
        </div>
        <div className="settings-card">
          <div className="card-header">
            <Icon name="ticket" />
            <h3>My Tickets</h3>
          </div>
          <p className="card-subtitle">Track the status of the issues you've raised.</p>
          <div className="ticket-list">
            {loading ? (
              <p role="status">Loading your tickets…</p>
            ) : tickets.length ? (
              tickets.map((ticket) => (
                <article className="ticket-item" key={ticket.id}>
                  <div className="ticket-item-head">
                    <div>
                      <h4>{ticket.subject}</h4>
                      <div className="ticket-meta">
                        {ticket.category} - {new Date(ticket.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className={`status-pill status-${ticket.status}`}>
                      {ticket.status?.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="ticket-desc">{ticket.description}</p>
                  <TicketRefund
                    ticket={ticket}
                    reservation={reservations.find(
                      (reservation) => reservation.id === ticket.linked_reservation_id,
                    )}
                  />
                  {ticket.linked_reservation_id && (
                    <PageLink page="details" params={{ id: ticket.linked_reservation_id }}>
                      View linked reservation
                    </PageLink>
                  )}
                  {ticket.resolution_notes && (
                    <div className="ticket-resolution">
                      <strong>Support Team:</strong> {ticket.resolution_notes}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <EmptyState title="You haven't raised any issues yet." />
            )}
          </div>
        </div>
      </div>
    </DinerLayout>
  );
}
