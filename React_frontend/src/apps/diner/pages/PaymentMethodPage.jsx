import { createAction } from "../../../app/actions.js";
import { useState, useContext } from "react";
import { StackedHeader, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState, ErrorMessage } from "../components/Feedback.jsx";
import { SecureBadge, reservationCost } from "../components/BookingSummary.jsx";
import PaymentMethods from "../components/PaymentMethods.jsx";
import { DinerContext } from "../context/DinerContext.js";
import { money, today } from "../utils/format.js";

export default function PaymentMethodPage() {
  const {
    api,
    booking: draftBooking,
    setBooking,
    restaurants,
    tables,
    reservations,
    slots,
    params,
    navigate,
    setConfirmation,
  } = useContext(DinerContext);
  const [method, setMethod] = useState("card");
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  const isAdditional = params.additional === "1";
  const additionalReservation = reservations.find((item) => item.id === params.id);
  const pendingModification = additionalReservation?.pending_modification;
  const additionalSlot = slots.find(
    (item) => item.id === (pendingModification?.slot_id || additionalReservation?.slot_id),
  );
  const booking =
    isAdditional && additionalReservation && additionalSlot
      ? {
          date: additionalSlot.slot_date || additionalSlot.date,
          time: additionalSlot.start_time,
          guests: pendingModification?.guest_count ?? additionalReservation.guest_count,
          tableId: pendingModification?.table_id || additionalReservation.table_id,
          restaurantId: additionalReservation.restaurant_id,
          reservation: additionalReservation,
        }
      : draftBooking;
  const restaurantId = isAdditional ? additionalReservation?.restaurant_id : booking?.restaurantId;
  const tableId = isAdditional
    ? pendingModification?.table_id || additionalReservation?.table_id
    : booking?.tableId;
  const restaurant = restaurants.find((item) => item.id === restaurantId);
  const table = tables.find((item) => item.id === tableId);
  const additionalDue = Number(pendingModification?.additional_payment_due || 0);
  const total = isAdditional ? additionalDue : reservationCost(restaurant, table?.capacity).total;

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
          throw new Error(
            "Cannot complete booking for a past date or time. Please select an upcoming slot.",
          );
        }
      }
      if (method === "card") {
        const [month, year] = values.expiry.split("/").map(Number);
        if (new Date(2000 + year, month, 1) <= new Date())
          throw new Error("Your card has expired.");
      }
      if (isAdditional) {
        const payment = await api.payAdditional(additionalReservation.id, method);
        setConfirmation({
          reservation: additionalReservation,
          payment,
          booking,
          method,
          additionalPayment: true,
        });
        setValues({});
        await api.refresh();
        navigate("confirmation");
        return;
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
          {!booking ||
          !restaurant ||
          (isAdditional &&
            (!additionalReservation || !pendingModification || additionalDue <= 0)) ? (
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
                <PageLink
                  page={isAdditional ? "additional_payment" : "payment_making"}
                  params={isAdditional ? { id: additionalReservation.id } : {}}
                  className="back-link"
                >
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
