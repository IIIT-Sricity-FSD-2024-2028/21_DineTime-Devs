import { useEffect, useRef, useContext } from "react";
import { DinerContext } from "../context/DinerContext.js";

export function ErrorMessage({ message }) {
  return message ? (
    <p className="diner-error" role="alert">
      {message}
    </p>
  ) : null;
}

export function EmptyState({ title = "Nothing here yet", children }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function DataState({ children }) {
  const { loading, error, api } = useContext(DinerContext);
  if (loading)
    return (
      <p className="diner-loading" role="status">
        Loading…
      </p>
    );
  if (error)
    return (
      <div className="diner-error" role="alert">
        {error}{" "}
        <button type="button" onClick={() => api.refresh()}>
          Try again
        </button>
      </div>
    );
  return children;
}

export function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="diner-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h3>{title}</h3>
        <button type="button" className="btn-close" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
