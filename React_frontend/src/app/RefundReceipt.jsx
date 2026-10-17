export function RefundReceipt({ refund }) {
  if (!refund) return null;
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    refund.amount,
  );
  return (
    <section
      aria-label="Refund receipt"
      style={{
        marginTop: 12,
        padding: 14,
        border: "1px solid #b9ddc5",
        borderRadius: 8,
        background: "#eff8f1",
        color: "#205c36",
        overflowWrap: "anywhere",
      }}
    >
      <strong>Refund recorded: {amount}</strong>
      <p>
        Reservation: {refund.reservation_id} · Refund ID: {refund.id}
      </p>
      <p>
        {new Date(refund.processed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} ·
        Finance: {refund.processed_by}
      </p>
      {refund.payments?.map((payment) => (
        <p key={payment.payment_id}>
          {payment.payment_id}:{" "}
          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
            payment.amount,
          )}
        </p>
      ))}
      {refund.mode === "demo" && <small>Demo payment refund</small>}
    </section>
  );
}
