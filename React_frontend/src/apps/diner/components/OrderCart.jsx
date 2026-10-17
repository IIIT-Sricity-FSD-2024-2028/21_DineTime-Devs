import { Icon } from "./Navigation.jsx";
import { money } from "../utils/format.js";

export default function OrderCart({ items, onChange, onSubmit, busy, canOrder }) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className="cart-box">
      <h2 className="cart-title">
        <Icon name="basket-shopping" /> Your Order
      </h2>
      {!items.length ? (
        <div className="cart-empty">
          <Icon name="cart-shopping" />
          <p>Your cart is empty.</p>
          <p>Add some delicious dishes!</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.item_name}</span>
                  <span className="cart-item-price">{money(item.price * item.quantity)}</span>
                </div>
                <div className="cart-controls">
                  <div className="qty-btn-group">
                    <button
                      className="btn-qty"
                      aria-label={`Remove one ${item.item_name}`}
                      onClick={() => onChange(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="qty-val">{item.quantity}</span>
                    <button
                      className="btn-qty"
                      aria-label={`Add one ${item.item_name}`}
                      onClick={() => onChange(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="btn-remove"
                    aria-label={`Remove ${item.item_name}`}
                    onClick={() => onChange(item.id, 0)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Tax (10%)</span>
              <span>{money(subtotal * 0.1)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{money(subtotal * 1.1)}</span>
            </div>
            <button className="btn-checkout" disabled={busy || !canOrder} onClick={onSubmit}>
              {busy ? "Placing order…" : "Place Order"} <Icon name="check" />
            </button>
            {!canOrder && <p>Check in at the restaurant before placing an order.</p>}
          </div>
        </>
      )}
    </div>
  );
}
