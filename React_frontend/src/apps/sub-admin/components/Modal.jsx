export function Modal({ open, children, narrow }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open">
      <div className={`modal-content ${narrow ? "narrow" : ""}`}>{children}</div>
    </div>
  );
}
