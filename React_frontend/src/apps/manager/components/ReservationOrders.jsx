import { useResource } from "../../../store/hooks/useResource.js";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(amount || 0),
  );

export default function ReservationOrders({ reservationId, storage }) {
  const query = useResource(`/orders?reservation_id=${encodeURIComponent(reservationId)}`, {
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
  });
  const orders = query.currentData || [];
  const loading = query.isFetching;
  const error = query.error?.message || "";
  return (
    <section className="reservation-orders" aria-label="Diner orders">
      <div className="reservation-orders-heading">
        <h4>Diner Orders</h4>
        <button
          type="button"
          className="btn btn-small"
          disabled={loading}
          onClick={() => query.refetch()}
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
