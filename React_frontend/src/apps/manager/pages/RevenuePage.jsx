import { useResource } from "../../../store/hooks/useResource.js";
import ManagerLayout from "../components/ManagerLayout";
import { useManager } from "../../../store/hooks/useManager.js";

export default function RevenuePage() {
  const { storage, navigate, data } = useManager();
  const { restaurantId, managerId } = data.ids || {};
  const revenueQuery = useResource(
    `/restaurants/${restaurantId}/revenue?manager_id=${encodeURIComponent(managerId || "")}`,
    { skip: !restaurantId || !managerId },
  );
  const revenue = revenueQuery.currentData || {
    pending_payout: 0,
    paid_by_platform: 0,
    payments: [],
  };
  const error = revenueQuery.error?.message || "";
  const settledPayments = (revenue.payments || []).filter(
    (payment) => payment.settled_at && payment.status !== "pending_payout",
  );
  return (
    <ManagerLayout
      title="Revenue"
      description="Track your restaurant revenue and payout history."
      pageClassName="manager-page-restaurant-header"
    >
      {error && (
        <p role="alert" className="phase1-error">
          {error}
        </p>
      )}
      <p className="phase1-lock-note">
        Funds remain held until manager completion. No-shows require finance review.
      </p>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => navigate("issues", { issue: "payout_missing" })}
      >
        Get Help with a Payout
      </button>
      <div className="revenue-grid">
        <div className="revenue-card revenue-pending">
          <h4>Yet to be Paid</h4>
          <p className="value">₹{revenue.pending_payout || 0}</p>
          <p className="note">Owed to you by the platform, not yet paid out.</p>
        </div>
        <div className="revenue-card revenue-paid">
          <h4>Already Paid by Platform</h4>
          <p className="value">₹{revenue.paid_by_platform || 0}</p>
          <p className="note">Total the platform has paid out to you so far.</p>
        </div>
      </div>
      <section className="revenue-table-container">
        <h3>Payment History</h3>
        <table className="revenue-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Date &amp; Time</th>
              <th>Reservation ID</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {settledPayments.length ? (
              settledPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_id || payment.id}</td>
                  <td>
                    {new Date(payment.settled_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td>{payment.reservation_id || "—"}</td>
                  <td>₹{payment.amount}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="empty-state">
                  No payouts received yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </ManagerLayout>
  );
}
