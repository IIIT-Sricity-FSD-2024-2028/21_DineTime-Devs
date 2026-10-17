import { useContext, useState } from "react";
import { DinerContext } from "../context/DinerContext.js";
import { StackedHeader, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import {
  BookingInformation,
  RestaurantSummary,
  SecureBadge,
} from "../components/BookingSummary.jsx";
import { money } from "../utils/format.js";

export default function AdditionalPaymentPage() {
  const { api, reservations, restaurants, tables, slots, params, navigate } =
    useContext(DinerContext);
  const [discardError, setDiscardError] = useState("");
  const reservation = reservations.find((item) => item.id === params.id);
  const proposal = reservation?.pending_modification;
  const restaurant = restaurants.find((item) => item.id === reservation?.restaurant_id);
  const table = tables.find((item) => item.id === (proposal?.table_id || reservation?.table_id));
  const slot = slots.find((item) => item.id === (proposal?.slot_id || reservation?.slot_id));
  const rate = Number(restaurant?.reservation_fee_per_guest ?? 30);
  const paidSeats = Number(reservation?.paid_seat_count || 0);
  const due = Number(
    proposal?.additional_payment_due ??
      Math.max(0, Number(table?.capacity || 0) - paidSeats) * rate,
  );
  const booking =
    reservation && slot
      ? {
          date: slot.slot_date || slot.date,
          time: slot.start_time,
          guests: proposal?.guest_count ?? reservation.guest_count,
          tableId: proposal?.table_id || reservation.table_id,
          restaurantId: reservation.restaurant_id,
        }
      : null;

  return (
    <>
      <StackedHeader />
      <main className="page-main">
        <DataState>
          {!reservation || !proposal || !restaurant || !table || !slot ? (
            <EmptyState title="Reservation summary unavailable">
              <PageLink page="reservations">View My Reservations</PageLink>
            </EmptyState>
          ) : due <= 0 ? (
            <EmptyState title="No additional payment is due">
              <PageLink page="details" params={{ id: reservation.id }}>
                Return to Reservation
              </PageLink>
            </EmptyState>
          ) : (
            <>
              <div className="review-card">
                <h1 className="page-title">Review Your Reservation</h1>
                <RestaurantSummary restaurant={restaurant} />
                <div className="info-section">
                  <h2 className="section-title">Reservation Information</h2>
                  <BookingInformation booking={booking} table={table} />
                </div>
              </div>
              <div className="cost-card">
                <h2 className="cost-title">Additional Payment Summary</h2>
                <div className="cost-lines">
                  <div className="cost-line">
                    <span className="cost-line-label">
                      Additional seat deposit ({Math.max(0, table.capacity - paidSeats)} seats)
                    </span>
                    <span className="cost-line-value">{money(due)}</span>
                  </div>
                  <div className="cost-line-note">
                    This amount covers the extra table seats beyond those already paid.
                  </div>
                </div>
                <div className="cost-divider" />
                <div className="cost-total-row">
                  <span className="cost-total-label">Total Amount</span>
                  <span className="cost-total-value">{money(due)}</span>
                </div>
                <SecureBadge />
              </div>
              <button
                className="btn-proceed"
                onClick={() => navigate("payment_method", { additional: "1", id: reservation.id })}
              >
                Continue to Payment Options
              </button>
              {discardError && (
                <p className="diner-error" role="alert">
                  {discardError}
                </p>
              )}
              <div className="modify-link-wrap">
                <button
                  type="button"
                  className="modify-link"
                  onClick={async () => {
                    try {
                      await api.discardModification(reservation.id);
                      navigate("details", { id: reservation.id });
                    } catch (error) {
                      setDiscardError(error.message || "Unable to keep the original reservation.");
                    }
                  }}
                >
                  Keep Original Reservation
                </button>
              </div>
            </>
          )}
        </DataState>
      </main>
    </>
  );
}
