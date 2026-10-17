import { useEffect, useState, useContext } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { ManagerContext } from "../context/ManagerContext.jsx";

export default function RevenuePage() {
  const { storage, navigate, data } = useContext(ManagerContext);
  const [error, setError] = useState("");
  const [revenue, setRevenue] = useState({
    pending_payout: 0,
    paid_by_platform: 0,
    payments: [],
  });
  useEffect(() => {
    let active = true;
    const load = async () => {
      const ids = storage._getIds();
      if (!ids.restaurantId || !ids.managerId) return;
      try {
        const response = await storage._request(
          `/restaurants/${ids.restaurantId}/revenue?manager_id=${encodeURIComponent(ids.managerId)}`,
          { headers: storage._headers("manager") },
        );
        if (active) setRevenue(response?.data || {});
      } catch (cause) {
        if (active) setError(cause.message);
      }
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [storage, data.restaurant?.id]);
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
