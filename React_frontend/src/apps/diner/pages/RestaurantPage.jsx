import { useState } from "react";
import { DinerLayout, Icon, PageLink } from "../components/Navigation.jsx";
import { DataState, EmptyState } from "../components/Feedback.jsx";
import { useDiner } from "../hooks/useDiner.js";
import { image } from "../utils/images.js";

export default function RestaurantPage() {
  const { restaurants, params, menu, reviews } = useDiner();
  const [slide, setSlide] = useState(0);
  const restaurant = restaurants.find((item) => item.id === params.id);
  const photos = restaurant?.images.length
    ? restaurant.images
    : [restaurant?.image];
  const restaurantReviews = reviews.filter(
    (review) => review.restaurant_id === restaurant?.id,
  );
  const details = restaurant?.details || {};
  return (
    <DinerLayout>
      <div className="page-body container">
        <DataState>
          {!restaurant ? (
            <EmptyState title="Restaurant not found">
              <PageLink page="browse">Browse restaurants</PageLink>
            </EmptyState>
          ) : (
            <>
              <section className="hero-section">
                <div className="carousel-wrapper">
                  <div
                    className="carousel-track"
                    style={{ transform: `translateX(-${slide * 100}%)` }}
                  >
                    {photos.map((photo, index) => (
                      <img
                        className="carousel-slide"
                        key={`${photo}-${index}`}
                        src={photo}
                        alt={`${restaurant.name}, photo ${index + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    className="carousel-btn prev"
                    aria-label="Previous photo"
                    onClick={() =>
                      setSlide((slide + photos.length - 1) % photos.length)
                    }
                  >
                    <Icon name="chevron-left" />
                  </button>
                  <button
                    className="carousel-btn next"
                    aria-label="Next photo"
                    onClick={() => setSlide((slide + 1) % photos.length)}
                  >
                    <Icon name="chevron-right" />
                  </button>
                  <div className="carousel-counter">
                    {slide + 1} / {photos.length}
                  </div>
                </div>
                <div className="info-card">
                  <h1 className="rest-name">{restaurant.name}</h1>
                  <p className="rest-subtitle">
                    {restaurant.cuisine} - {restaurant.city}
                  </p>
                  <div className="rating-row">
                    <Icon name="star" className="star-icon" />
                    <span className="rating-value">
                      {restaurant.total_reviews ? restaurant.rating : "New"}
                    </span>
                    <span className="review-count">
                      ({restaurant.total_reviews || 0} reviews)
                    </span>
                  </div>
                  <div className="location-row">
                    <Icon name="location-dot" className="location-icon" />
                    <span>{restaurant.location}</span>
                  </div>
                  <div className="price-row">
                    <span className="price-badge">
                      {details.price || "Price not provided"}
                    </span>
                  </div>
                  <div className="amenities-row">
                    {(details.amenities || "Amenities not provided")
                      .split(",")
                      .map((amenity) => (
                        <span key={amenity} className="amenity-tag">
                          {amenity}
                        </span>
                      ))}
                  </div>
                  <PageLink
                    page="book"
                    params={{ id: restaurant.id }}
                    className="btn-reserve-main"
                  >
                    Reserve Table
                  </PageLink>
                </div>
              </section>
              <section className="detail-card">
                <h2>About the Restaurant</h2>
                <p className="about-text">{restaurant.about}</p>
                <div className="about-grid">
                  {[
                    ["phone", "Phone Number", details.contact || details.phone],
                    [
                      "clock",
                      "Opening Hours",
                      details.hours || details.openinghours,
                    ],
                    ["square-parking", "Parking", details.parking],
                    ["shirt", "Dress Code", details.dresscode],
                  ].map(([icon, label, value]) => (
                    <div className="about-item" key={label}>
                      <Icon name={icon} className="about-item-icon" />
                      <div className="about-item-text">
                        <strong>{label}</strong>
                        <span>{value || "Not provided"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="detail-card">
                <h2>Reservation Policies</h2>
                <div className="policies-grid">
                  <div className="policy-item">
                    <strong>Cancellation Policy</strong>
                    <span>
                      Cancellations must be made at least{" "}
                      {restaurant.cancellation_cutoff_minutes ?? 120} minutes
                      before your reservation.
                    </span>
                  </div>
                  <div className="policy-item">
                    <strong>No-Show Policy</strong>
                    <span>
                      Your table is held for{" "}
                      {restaurant.no_show_grace_minutes ?? 15} minutes past the
                      reservation time.
                    </span>
                  </div>
                </div>
              </section>
              <section className="detail-card">
                <h2>Operational Hours</h2>
                <div className="hours-list">
                  <div className="hours-row">
                    <span className="hours-label">Everyday</span>
                    <span className="hours-time">
                      {details.hours ||
                        details.openinghours ||
                        "Hours not provided"}
                    </span>
                  </div>
                </div>
              </section>
              <section className="detail-card">
                <h2>Menu Highlights</h2>
                <div className="menu-grid">
                  {menu
                    .filter((item) => item.restaurant_id === restaurant.id)
                    .slice(0, 4)
                    .map((item) => (
                      <div className="menu-img-wrapper" key={item.id}>
                        <img
                          src={item.image}
                          alt={item.item_name}
                          loading="lazy"
                        />
                      </div>
                    ))}
                </div>
                <PageLink page="menu" params={{ id: restaurant.id }}>
                  View Restaurant Menu
                </PageLink>
              </section>
              <section className="detail-card">
                <h2>Customer Reviews</h2>
                <div className="reviews-grid">
                  {restaurantReviews.map((review) => (
                    <article className="review-card" key={review.id}>
                      <div className="reviewer-row">
                        <img
                          src={image("logo.png")}
                          className="reviewer-avatar"
                          alt=""
                        />
                        <div>
                          <div className="reviewer-name">
                            {review.name || "Guest"}
                          </div>
                          <div
                            className="review-stars"
                            aria-label={`${review.rating} out of 5 stars`}
                          >
                            {"★".repeat(review.rating)}
                          </div>
                        </div>
                      </div>
                      <p className="review-text">{review.comment}</p>
                    </article>
                  ))}
                </div>
                {!restaurantReviews.length && (
                  <EmptyState title="No customer reviews yet." />
                )}
              </section>
            </>
          )}
        </DataState>
      </div>
    </DinerLayout>
  );
}
