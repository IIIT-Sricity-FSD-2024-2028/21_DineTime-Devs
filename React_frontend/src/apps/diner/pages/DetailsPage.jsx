import { useEffect, useState, useContext } from "react";
import QRCode from "qrcode";
import { DinerLayout, Hero, PageLink, Icon } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import { StatusBadge, canModify } from "../components/ReservationCard.jsx";
import ReservationPayment from "../components/ReservationPayment.jsx";
import { BookingInformation } from "../components/BookingSummary.jsx";
import { DinerContext } from "../context/DinerContext.js";

export default function DetailsPage() {
  const { params, reservations, restaurants, slots, tables } = useContext(DinerContext);
  const reservation = reservations.find((item) => item.id === params.id);
  const restaurant = restaurants.find((item) => item.id === reservation?.restaurant_id);
  const slot = slots.find((item) => item.id === reservation?.slot_id);
  const table = tables.find((item) => item.id === reservation?.table_id);
  const [qr, setQr] = useState("");
  useEffect(() => {
    let active = true;
    if (reservation)
      QRCode.toDataURL(reservation.id, { margin: 1, width: 180 })
        .then((url) => {
          if (active) setQr(url);
        })
        .catch(() => {
          if (active) setQr("");
        });
    return () => {
      active = false;
    };
  }, [reservation?.id]);
  const cancelled = ["cancelled", "no_show"].includes(reservation?.reservation_status);
  return (
    <DinerLayout header={false}>
      <Hero title="Reservation Check-In" subtitle="Confirm your arrival and get seated quickly" />
      <div className="content-area">
        <DataState>
          {!reservation ? (
            <EmptyState title="Reservation not found">
              <PageLink page="reservations">Back to My Reservations</PageLink>
            </EmptyState>
          ) : (
            <>
              <div className="card card-pass">
                <div className="pass-header">
                  <img
                    src={restaurant?.image}
                    alt={restaurant?.name || "Restaurant"}
                    className="pass-thumb"
                  />
                  <div className="pass-title-row">
                    <div className="pass-title-info">
                      <h2 className="pass-restaurant">{restaurant?.name}</h2>
                      <p className="pass-cuisine">{restaurant?.cuisine}</p>
                    </div>
                    <StatusBadge status={reservation.reservation_status} />
                  </div>
                </div>
                <div className="pass-body">
                  <BookingInformation
                    booking={{
                      date: slot?.slot_date || slot?.date,
                      time: slot?.start_time,
                      guests: reservation.guest_count,
                      tableId: reservation.table_id,
                    }}
                    table={table}
                    tables={tables.filter((item) =>
                      (reservation.table_ids || [reservation.table_id]).includes(item.id),
                    )}
                    className="pass-info-grid"
                  />
                  <div className="pass-location">
                    <span className="detail-label">
                      <Icon name="location-dot" /> Restaurant Location
                    </span>
                    <span className="detail-value">{restaurant?.location}</span>
                  </div>
                  <ReservationPayment reservation={reservation} />
                  {restaurant?.is_open === false &&
                    reservation.reservation_status === "reserved" && (
                      <p role="status">
                        New reservations are paused. Your booking remains confirmed and can still be
                        checked in or rescheduled.
                      </p>
                    )}
                  <div className="reservation-extra-actions">
                    {canModify(reservation, slot) && (
                      <PageLink
                        page="modify"
                        params={{ id: reservation.id }}
                        className="btn-view-details"
                      >
                        Modify Reservation
                      </PageLink>
                    )}
                    <PageLink
                      page="support"
                      params={{ reservation: reservation.id }}
                      className="btn-view-details"
                    >
                      Get Help with This Reservation
                    </PageLink>
                  </div>
                </div>
                <div className="pass-footer">
                  {cancelled ? (
                    <p>
                      This reservation was cancelled. You may book another reservation by browsing
                      available restaurants.
                    </p>
                  ) : (
                    <div className="pass-qr-section">
                      <div className="qr-wrapper-static">
                        {qr && (
                          <img
                            src={qr}
                            alt={`Reservation code for ${reservation.id}`}
                            className="qr-image-static"
                          />
                        )}
                        <p className="qr-label">
                          <Icon name="qrcode" /> Scan to Check-In
                        </p>
                      </div>
                      <div className="qr-info">
                        <p className="qr-hint">
                          Please present this QR code or your reservation ID at the restaurant
                          entrance to confirm your arrival and get seated.
                        </p>
                        <p className="res-id-label">
                          Reservation ID: <span>{reservation.id}</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {!cancelled && (
                    <div className="menu-btn-container">
                      <PageLink
                        page="menu"
                        params={{
                          id: reservation.restaurant_id,
                          reservation: reservation.id,
                        }}
                        className="btn-menu"
                      >
                        <Icon name="utensils" /> View Restaurant Menu
                      </PageLink>
                    </div>
                  )}
                </div>
              </div>
              <PageLink page="reservations" className="btn-back">
                ← Back to My Reservations
              </PageLink>
            </>
          )}
        </DataState>
      </div>
    </DinerLayout>
  );
}
