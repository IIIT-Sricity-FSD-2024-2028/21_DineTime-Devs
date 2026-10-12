import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type, show: false }]);
    setTimeout(() => setToasts((items) => items.map((item) => (item.id === id ? { ...item, show: true } : item))), 10);
    setTimeout(() => {
      setToasts((items) => items.map((item) => (item.id === id ? { ...item, show: false } : item)));
      setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 300);
    }, 3000);
  }

  const value = useMemo(() => ({ showToast }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toast-container">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.type} ${toast.show ? 'show' : ''}`}><i className="fa-solid fa-circle-info" /> {toast.message}</div>)}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
