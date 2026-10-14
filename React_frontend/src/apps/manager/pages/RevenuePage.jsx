import { useEffect, useState } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { useManager } from "../hooks/useManager";

export default function RevenuePage() {
  const { storage } = useManager();
  const [revenue, setRevenue] = useState({
    pending_payout: 0,
    paid_by_platform: 0,
    settlement_history: [],
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
      } catch {
        if (active)
          setRevenue({
            pending_payout: 0,
            paid_by_platform: 0,
            settlement_history: [],
          });
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [storage]);
  return (
    <ManagerLayout
      title="Revenue"
      description="What the platform still owes you, and what it has already paid you."
      pageClassName="manager-page-restaurant-header"
    >
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
        <h3>Payout History</h3>
        <table className="revenue-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {revenue.settlement_history?.length ? (
              revenue.settlement_history.map((entry) => (
                <tr key={`${entry.settled_at}-${entry.amount}`}>
                  <td>{new Date(entry.settled_at).toLocaleString()}</td>
                  <td>₹{entry.amount}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="empty-state">
                  No payouts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </ManagerLayout>
  );
}

