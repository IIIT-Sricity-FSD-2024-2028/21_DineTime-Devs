import { useEffect, useState } from "react";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(amount || 0),
  );

export default function ReservationOrders({ reservationId, storage }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await storage.getReservationOrders(reservationId);
        if (active) {
          setOrders(data);
          setError("");
        }
      } catch (cause) {
        if (active) setError(cause.message || "Unable to load orders.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    setLoading(true);
    load();
    const timer = window.setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [storage, reservationId, attempt]);
  return (
    <section className="reservation-orders" aria-label="Diner orders">
      <div className="reservation-orders-heading">
        <h4>Diner Orders</h4>
        <button
          type="button"
          className="btn btn-small"
          disabled={loading}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Refresh Orders
        </button>
      </div>
      {loading && <p role="status">Loading orders…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !orders.length && (
        <p>
          No orders placed for this reservation yet. Orders appear after the diner checks in and
          places an order.
        </p>
      )}
      {orders.map((order) => (
        <article key={order.id} className="reservation-order">
          <div className="reservation-order-meta">
            <strong>{order.id}</strong>
            <span>{order.order_status?.replaceAll("_", " ")}</span>
            <time>{new Date(order.order_time).toLocaleString()}</time>
          </div>
          <div className="reservation-order-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.item_id}:${index}`}>
                    <td>{item.item_name}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.price)}</td>
                    <td>{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="reservation-order-total">
            Subtotal: {money(order.subtotal)} · Tax (10%): {money(order.tax)}
          </p>
          <p className="reservation-order-total">
            <strong>Order total: {money(order.total)}</strong>
          </p>
        </article>
      ))}
    </section>
  );
}
