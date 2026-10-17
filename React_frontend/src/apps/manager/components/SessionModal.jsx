import { useEffect, useState } from "react";
export default function SessionModal({ title, onClose, children }) {
  const [id] = useState(() => `manager-dialog-${crypto.randomUUID()}`);
  useEffect(() => {
    const dialog = document.getElementById(id);
    dialog.showModal();
    return () => dialog.close();
  }, [id]);
  return (
    <dialog id={id} className="session-dialog" onCancel={onClose}>
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
