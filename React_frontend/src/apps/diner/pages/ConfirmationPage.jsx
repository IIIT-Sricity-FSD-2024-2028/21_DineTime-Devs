import { StackedHeader, Icon, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import {
  BookingInformation,
  RestaurantSummary,
} from "../components/BookingSummary.jsx";
import { useDiner } from "../hooks/useDiner.js";
import { money } from "../utils/format.js";

export default function ConfirmationPage() {
  const { confirmation, restaurants, tables } = useDiner();
  const restaurant = restaurants.find(
    (item) => item.id === confirmation?.booking.restaurantId,
  );
  const table = tables.find(
    (item) => item.id === confirmation?.booking.tableId,
  );
  return (
    <>
      <StackedHeader />
      <main className="page-main">
        <DataState>
          {!confirmation || !restaurant ? (
            <EmptyState title="No confirmation to display">
              <PageLink page="reservations">View My Reservations</PageLink>
            </EmptyState>
          ) : (
            <>
              <div className="success-hero">
                <div className="check-circle">
                  <Icon name="check" className="check-icon" />
                </div>
                <h1 className="confirmed-title">Reservation Confirmed!</h1>
                <p className="confirmed-sub">
                  Your table has been successfully reserved. We look forward to
                  serving you.
                </p>
              </div>
              <div className="details-card">
                <h2 className="card-section-title">Reservation Details</h2>
                <div className="card-divider" />
                <RestaurantSummary restaurant={restaurant} />
                <div className="card-divider" />
                <h3 className="booking-section-title">Booking Information</h3>
                <BookingInformation
                  booking={confirmation.booking}
                  table={table}
                  className="booking-grid"
                />
                <p>Reservation ID: {confirmation.reservation.id}</p>
                <div className="card-divider" />
                <h3 className="booking-section-title">Payment Confirmation</h3>
                <div className="payment-confirm-box">
                  <Icon name="circle-check" />
                  <div>
                    <strong>
                      {money(confirmation.payment.amount)} paid via{" "}
                      {confirmation.method}
                    </strong>
                    <p>Transaction: {confirmation.payment.transaction_ref}</p>
                  </div>
                </div>
                <div className="arrive-notice">
                  <Icon name="circle-info" className="arrive-icon" />
                  <span>
                    Please arrive 10 minutes before your reservation time.
                  </span>
                </div>
              </div>
              <div className="action-row">
                <PageLink page="reservations" className="btn-reservations">
                  View My Reservations
                </PageLink>
                <PageLink page="browse" className="btn-explore">
                  Explore More Restaurants
                </PageLink>
              </div>
            </>
          )}
        </DataState>
      </main>
    </>
  );
}
