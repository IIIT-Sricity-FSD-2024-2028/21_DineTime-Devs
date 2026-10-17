import { useState, useContext } from "react";
import ManagerLayout from "../components/ManagerLayout";
import { ManagerContext } from "../context/ManagerContext.jsx";
import { ToastContext } from "../context/ToastContext.jsx";

export default function ReviewsPage() {
  const { data, storage, refresh } = useContext(ManagerContext);
  const { showToast } = useContext(ToastContext);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [editingId, setEditingId] = useState(null);
  const [reply, setReply] = useState("");
  const reviews = data?.reviews || [];
  const average = reviews.length
    ? (
        reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
      ).toFixed(1)
    : "0.0";
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => Number(review.rating) === rating).length,
  }));
  const filtered = (() => {
    const result =
      filter === "all"
        ? [...reviews]
        : reviews.filter((review) => String(review.rating) === filter);
    if (sort === "highest") result.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") result.sort((a, b) => a.rating - b.rating);
    return result;
  })();

  const openReply = (review) => {
    setEditingId(review.id);
    setReply(review.reply || "");
  };

  const saveReply = async (review) => {
    if (!reply.trim()) return;
    try {
      await storage.saveReviewReply(review.id, reply.trim());
      refresh();
      setEditingId(null);
      setReply("");
      showToast("Manager response saved.");
    } catch (error) {
      showToast(error.message || "Failed to save response.", "error");
    }
  };

  const deleteReply = async (review) => {
    if (!window.confirm("Are you sure you want to delete your response? This cannot be undone."))
      return;
    try {
      await storage.deleteReviewReply(review.id);
      refresh();
      showToast("Manager response deleted.", "error");
    } catch (error) {
      showToast(error.message || "Failed to delete response.", "error");
    }
  };

  return (
    <ManagerLayout
      title="Customer Reviews"
      description="View and respond to feedback from diners who recently visited your restaurant."
      pageClassName="manager-page-restaurant-header"
    >
      <section className="overview-card">
        <div className="overview-score">
          <h4>Rating Overview</h4>
          <h1>
            {average} <i className="ph-fill ph-star" />
          </h1>
          <p>{reviews.length} Reviews</p>
        </div>
        <div className="overview-bars">
          {distribution.map(({ rating, count }) => (
            <div className="progress-row" key={rating}>
              <span>
                {rating} <i className="ph-fill ph-star" />
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${reviews.length ? Math.round((count / reviews.length) * 100) : 0}%`,
                  }}
                />
              </div>
              <span className="progress-pct">
                {reviews.length ? Math.round((count / reviews.length) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="filter-toolbar">
        <div className="filter-group">
          {["all", "5", "4", "3", "2", "1"].map((value) => (
            <button
              className={`filter-pill ${filter === value ? "active" : ""}`}
              type="button"
              key={value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All Reviews" : `${value} Stars`}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="recent">Most Recent</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
        </select>
      </div>
      <div id="reviews-feed">
        {filtered.length ? (
          filtered.map((review) => (
            <article className="review-card" key={review.id}>
              <div className="review-header">
                <div className="reviewer-info">
                  <div className="avatar-initials">{review.initials}</div>
                  <div className="reviewer-details">
                    <h5>{review.author}</h5>
                    <span>
                      <i className="ph ph-calendar-blank" /> {review.date}
                    </span>
                  </div>
                </div>
                <div className="badges">
                  <span className={`badge ${review.reply ? "badge-responded" : "badge-pending"}`}>
                    {review.reply ? "Responded" : "Pending Response"}
                  </span>
                </div>
              </div>
              <div className="review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    className={`ph-fill ph-star ${star <= review.rating ? "" : "empty"}`}
                    key={star}
                  />
                ))}
              </div>
              <p className="review-text">{review.comment}</p>
              {review.reply && editingId !== review.id && (
                <div className="manager-response-box">
                  <h6>Manager Response</h6>
                  <p>{review.reply}</p>
                  <div className="response-actions">
                    <button
                      className="action-link edit"
                      type="button"
                      onClick={() => openReply(review)}
                    >
                      Edit
                    </button>
                    <button
                      className="action-link delete"
                      type="button"
                      onClick={() => deleteReply(review)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              {!review.reply && editingId !== review.id && (
                <div>
                  <button className="btn-reply" type="button" onClick={() => openReply(review)}>
                    Reply
                  </button>
                </div>
              )}
              {editingId === review.id && (
                <div className="reply-editor-container">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write your response..."
                  />
                  <div className="response-actions">
                    <button
                      className="btn btn-primary-green btn-small"
                      type="button"
                      onClick={() => saveReply(review)}
                    >
                      Save Response
                    </button>
                    <button
                      className="btn btn-small"
                      type="button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state empty-state-panel">
            <i className="ph ph-star" />
            <p>No reviews found matching your selected filters.</p>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
