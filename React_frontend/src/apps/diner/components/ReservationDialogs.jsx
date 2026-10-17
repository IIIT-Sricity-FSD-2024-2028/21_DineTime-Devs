import { createAction } from "../../../app/actions.js";
import { useState, useContext } from "react";
import { Modal, ErrorMessage } from "./Feedback.jsx";
import { DinerContext } from "../context/DinerContext.js";

export function CancelDialog({ reservation, onClose }) {
  const { api } = useContext(DinerContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  return (
    <Modal title="Cancel Reservation" onClose={onClose}>
      <p>Are you sure you want to cancel this reservation?</p>
      <ErrorMessage message={error} />
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose}>
          Keep Reservation
        </button>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.cancelReservation(reservation.id);
              onClose();
            })
          }
        >
          {busy ? "Cancelling…" : "Confirm Cancellation"}
        </button>
      </div>
    </Modal>
  );
}

export function ReviewDialog({ reservation, onClose }) {
  const { api, reviews, restaurants } = useContext(DinerContext);
  const existing = reviews.find((review) => review.reservation_id === reservation.id);
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [run] = useState(() => createAction(setBusy, setError));
  return (
    <Modal title={existing ? "Your Rating" : "Rate Experience"} onClose={onClose}>
      <p className="modal-subtitle">
        How was your visit to{" "}
        {restaurants.find((item) => item.id === reservation.restaurant_id)?.name}?
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            await api.review(reservation, rating, comment);
            onClose();
          });
        }}
      >
        <div className="star-rating" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`star-btn ${rating >= star ? "active" : ""}`}
              aria-label={`${star} stars`}
              aria-pressed={rating === star}
              disabled={Boolean(existing)}
              onClick={() => setRating(star)}
            >
              ★
            </button>
          ))}
        </div>
        <label className="form-group">
          Review Notes
          <textarea
            className="form-control"
            rows={3}
            placeholder="Write a review..."
            value={comment}
            readOnly={Boolean(existing)}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <ErrorMessage message={error} />
        {!existing && (
          <button className="btn btn-primary" disabled={busy || !rating}>
            {busy ? "Submitting…" : "Submit"}
          </button>
        )}
      </form>
    </Modal>
  );
}
