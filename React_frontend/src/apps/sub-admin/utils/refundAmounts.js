// Older API responses contain the payment but not the aggregated amount fields.
// The full audit also includes additional payments for reservation modifications.
export function withRefundAmounts(ticket, audit = []) {
  const reservationId =
    ticket.linked_reservation_id || ticket.reservation?.id || ticket.payment?.reservation_id;
  const auditPayments = reservationId
    ? audit.filter(
        (payment) =>
          payment.reservation_id === reservationId &&
          ["paid", "refunded"].includes(payment.status || payment.payment_status),
      )
    : [];
  const payments = Array.isArray(ticket.payments)
    ? ticket.payments
    : auditPayments.length
      ? auditPayments.map((payment) => ({
          ...(payment.payment_id && payment.payment_id === ticket.payment?.id
            ? ticket.payment
            : {}),
          ...payment,
        }))
      : ticket.payment
        ? [ticket.payment]
        : [];
  const paid = payments.filter((payment) =>
    ["paid", "refunded"].includes(payment.payment_status || payment.status),
  );
  const round = (amount) => Math.round(amount * 100) / 100;
  const fee = (payment) =>
    Number(
      payment.diner_platform_fee ??
        (payment.deposit_amount != null
          ? Number(payment.amount) - Number(payment.deposit_amount)
          : 0),
    );
  return {
    ...ticket,
    total_paid_amount:
      ticket.total_paid_amount ??
      round(paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
    diner_platform_fee_amount:
      ticket.diner_platform_fee_amount ??
      round(paid.reduce((sum, payment) => sum + fee(payment), 0)),
    refund_eligible_amount:
      ticket.refund_eligible_amount ??
      paid.reduce(
        (sum, payment) =>
          sum +
          Math.max(
            0,
            Math.round(Number(payment.amount || 0) * 100) - Math.round(fee(payment) * 100),
          ),
        0,
      ) / 100,
    already_refunded_amount:
      ticket.already_refunded_amount ??
      round(paid.reduce((sum, payment) => sum + Number(payment.refunded_amount || 0), 0)),
    refundable_amount:
      ticket.refundable_amount ??
      paid.reduce(
        (sum, payment) =>
          sum +
          Math.max(
            0,
            Math.round(Number(payment.amount || 0) * 100) -
              Math.round(fee(payment) * 100) -
              Math.round(Number(payment.refunded_amount || 0) * 100),
          ),
        0,
      ) / 100,
  };
}
