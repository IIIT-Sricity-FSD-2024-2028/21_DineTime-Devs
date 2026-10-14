import { useState } from "react";
import { StackedHeader, PageLink } from "../components/Navigation.jsx";
import {
  DataState,
  EmptyState,
  ErrorMessage,
} from "../components/Feedback.jsx";
import { SecureBadge, reservationCost } from "../components/BookingSummary.jsx";
import PaymentMethods from "../components/PaymentMethods.jsx";
import { useAction, useDiner } from "../hooks/useDiner.js";
import { money, today } from "../utils/format.js";

export default function PaymentMethodPage() {
  const { api, booking, setBooking, restaurants, navigate, setConfirmation } =
    useDiner();
  const [method, setMethod] = useState("card");
  const [values, setValues] = useState({});
  const { run, error, busy } = useAction();
  const restaurant = restaurants.find(
    (item) => item.id === booking?.restaurantId,
  );
  const total = reservationCost(restaurant, booking?.guests).total;

  function pay(event) {
    event.preventDefault();
    run(async () => {
      if (booking?.date) {
        const todayStr = today();
        let isPast = booking.date < todayStr;
        if (booking.date === todayStr && booking.time) {
          const now = new Date();
          const [h = 0, m = 0] = String(booking.time).split(":").map(Number);
          if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
            isPast = true;
          }
        }
        if (isPast) {
          throw new Error("Cannot complete booking for a past date or time. Please select an upcoming slot.");
        }
      }
      if (method === "card") {
        const [month, year] = values.expiry.split("/").map(Number);
        if (new Date(2000 + year, month, 1) <= new Date())
          throw new Error("Your card has expired.");
      }
      let reservation = booking.reservation;
      let createdThisAttempt = false;
      if (!reservation) {
        reservation = await api.createReservation(booking);
        createdThisAttempt = true;
        setBooking({ ...booking, reservation });
      }
      try {
        const payment = await api.pay(reservation.id, method);
        setConfirmation({ reservation, payment, booking, method });
        setValues({});
        await api.refresh();
        navigate("confirmation");
      } catch (payError) {
        if (createdThisAttempt && reservation?.id) {
          try {
            await api.deleteReservation(reservation.id);
            setBooking({ ...booking, reservation: null });
          } catch (_) {}
        }
        throw payError;
      }
    });
  }

  return (
    <>
      <StackedHeader />
      <main className="page-main">
        <DataState>
          {!booking || !restaurant ? (
            <EmptyState title="No reservation selected">
              <PageLink page="browse">Browse restaurants</PageLink>
            </EmptyState>
          ) : (
            <form className="payment-card" onSubmit={pay}>
              <h1 className="page-title">Choose Payment Method</h1>
              <PaymentMethods
                method={method}
                setMethod={setMethod}
                values={values}
                setValues={setValues}
              />
              <SecureBadge />
              <ErrorMessage message={error} />
              <button className="btn-pay" disabled={busy}>
                {busy ? "Processing…" : `Pay ${money(total)}`}
              </button>
              <div className="back-link-wrap">
                <PageLink page="payment_making" className="back-link">
                  ← Back to Reservation Summary
                </PageLink>
              </div>
            </form>
          )}
        </DataState>
      </main>
    </>
  );
}
