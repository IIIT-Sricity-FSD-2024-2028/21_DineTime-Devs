import { StackedHeader, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import {
  BookingInformation,
  CostSummary,
  RestaurantSummary,
} from "../components/BookingSummary.jsx";
import { useDiner } from "../hooks/useDiner.js";
import { today } from "../utils/format.js";

export default function PaymentMakingPage() {
  const { booking, restaurants, tables, navigate } = useDiner();
  const restaurant = restaurants.find(
    (item) => item.id === booking?.restaurantId,
  );
  const table = tables.find((item) => item.id === booking?.tableId);

  const isPast = () => {
    if (!booking?.date) return false;
    const todayStr = today();
    if (booking.date < todayStr) return true;
    if (booking.date === todayStr && booking.time) {
      const now = new Date();
      const [h = 0, m = 0] = String(booking.time).split(":").map(Number);
      return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
    }
    return false;
  };
  const past = isPast();

  return (
    <>
      <StackedHeader />
      <main className="page-main">
        <DataState>
          {!booking || !restaurant ? (
            <EmptyState title="No reservation selected">
              <PageLink page="browse">
                Choose a restaurant to get started
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
              <CostSummary restaurant={restaurant} booking={booking} />
              {past && (
                <div style={{ color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: "8px", margin: "16px 0", fontSize: "0.95rem" }}>
                  This reservation slot is in the past. Please modify your reservation to pick an upcoming date and time.
                </div>
              )}
              <button
                className="btn-proceed"
                disabled={past}
                onClick={() => {
                  if (!past) navigate("payment_method");
                }}
              >
                Proceed to Payment
              </button>
              <div className="modify-link-wrap">
                <PageLink
                  page="book"
                  params={{ id: restaurant.id }}
                  className="modify-link"
                >
                  ← Modify Reservation
                </PageLink>
              </div>
            </>
          )}
        </DataState>
      </main>
    </>
  );
}
