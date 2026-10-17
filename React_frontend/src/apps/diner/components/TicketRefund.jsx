import { RefundReceipt } from "../../../app/RefundReceipt.jsx";
import { money } from "../utils/format.js";

export default function TicketRefund({ ticket, reservation }) {
  if (ticket.refund) return <RefundReceipt refund={ticket.refund} />;
  const amount = Number(
    ticket.reservation_refunded_amount ?? reservation?.payment_summary?.refunded_amount ?? 0,
  );
  if (ticket.status !== "resolved" || !ticket.linked_reservation_id || !(amount > 0)) return null;
  return (
    <section className="ticket-resolution" aria-label="Reservation refund">
      <strong>Amount refunded: {money(amount)}</strong>
      <div>For linked reservation {ticket.linked_reservation_id}.</div>
    </section>
  );
}
