import { bookingActions } from "../slices/bookingSlice.js";
import { createRequest } from "./request.js";

// Prices and availability are always checked by the server.
export const completeBooking =
  ({ booking, method, additional = false }) =>
  async (dispatch, getState) => {
    const auth = getState().auth;
    if (!auth.session) throw new Error("Please sign in before making a reservation.");
    if (getState().booking.status === "pending") return;
    const request = createRequest(dispatch, getState, auth.generation);
    const draft = getState().booking.draft;
    const sameSelection =
      draft &&
      ["restaurantId", "slotId", "tableId", "guests"].every((key) => draft[key] === booking[key]);
    let reservation = booking.reservation || (sameSelection ? draft.reservation : null);
    dispatch(bookingActions.submitted());
    try {
      if (additional && !reservation)
        throw new Error("Choose a reservation before paying the difference.");
      if (!reservation) {
        reservation = await request("/reservations", {
          method: "POST",
          body: {
            user_id: auth.session.user.id,
            restaurant_id: booking.restaurantId,
            table_id: booking.tableId,
            slot_id: booking.slotId,
            guest_count: Number(booking.guests),
          },
        });
        dispatch(bookingActions.draftChanged({ ...booking, reservation }));
      }
      const payment = await request(additional ? "/payments/additional" : "/payments", {
        method: "POST",
        body: {
          reservation_id: reservation.id,
          payment_method: method,
          transaction_ref: `DT-${additional ? "ADJ" : "TXN"}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          ...(!additional ? { payment_status: "paid" } : {}),
        },
      });
      if (payment?.payment_status === "failed")
        throw new Error("Payment failed. Please try again.");
      const result = {
        reservation,
        payment,
        booking,
        method,
        additionalPayment: additional,
      };
      dispatch(bookingActions.confirmed(result));
      return result;
    } catch (error) {
      if (auth.generation === getState().auth.generation) {
        dispatch(bookingActions.failed());
      }
      throw error;
    }
  };
