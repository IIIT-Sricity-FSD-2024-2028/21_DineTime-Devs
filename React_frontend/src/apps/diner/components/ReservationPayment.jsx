import { money } from "../utils/format.js";

export default function ReservationPayment({ reservation, compact = false }) {
  const payment = reservation.payment_summary;
  if (!payment) return <p className="reservation-payment-note">Payment not recorded</p>;
  const received = ["paid", "refunded"].includes(payment.payment_status);
  if (compact)
    return (
      <p className="reservation-payment-note">
        {received ? "Amount paid" : "Payment amount"}: <strong>{money(payment.amount)}</strong>
        {" · "}
        {payment.payment_status}
        {payment.refunded_amount > 0 && ` · Refunded ${money(payment.refunded_amount)}`}
      </p>
    );
  return (
    <section className="reservation-payment" aria-label="Reservation payment">
      <h3>Reservation Payment</h3>
      <dl>
        <div>
          <dt>{received ? "Amount paid" : "Payment amount"}</dt>
          <dd>{money(payment.amount)}</dd>
        </div>
        <div>
          <dt>Reservation deposit</dt>
          <dd>{money(payment.deposit_amount)}</dd>
        </div>
        <div>
          <dt>Platform service fee</dt>
          <dd>{money(payment.diner_platform_fee)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{payment.payment_status}</dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>{payment.payment_method}</dd>
        </div>
        <div>
          <dt>Transaction reference</dt>
          <dd>{payment.transaction_ref || "—"}</dd>
        </div>
        {payment.refunded_amount > 0 && (
          <div>
            <dt>Amount refunded</dt>
            <dd>{money(payment.refunded_amount)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
