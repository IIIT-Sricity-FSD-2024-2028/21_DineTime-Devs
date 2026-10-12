import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import checkInStyles from "../styles/check-in.css?inline";
import dashboardStyles from "../styles/dashboard.css?inline";
import loginStyles from "../styles/login.css?inline";
import profileStyles from "../styles/profile.css?inline";
import registrationStyles from "../styles/registration.css?inline";
import requestStyles from "../styles/request.css?inline";
import { image } from "../utils/images.js";

const pageStyles = {
  "check-in": checkInStyles,
  dashboard: dashboardStyles,
  login: loginStyles,
  profile: profileStyles,
  register: registrationStyles,
  request: requestStyles,
};

const sharedStyles = `
/* ─── Global Toast Notifications (All Staff Pages) ─────────────────── */
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
  max-width: 420px;
  width: calc(100% - 48px);
}

.toast-notification {
  background: #1e293b;
  color: #f8fafc;
  padding: 14px 18px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
  font-weight: 500;
  font-size: 0.92rem;
  line-height: 1.4;
  border-left: 4px solid #4ade80;
  pointer-events: auto;
  animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.toast-notification.error {
  border-left-color: #ef4444;
}

.toast-notification.warning {
  border-left-color: #f59e0b;
}

.toast-notification.info {
  border-left-color: #3b82f6;
}

.toast-notification i {
  font-size: 1.15rem;
  color: #4ade80;
  flex-shrink: 0;
}

.toast-notification.error i {
  color: #ef4444;
}

.toast-notification.warning i {
  color: #f59e0b;
}

.toast-notification.info i {
  color: #3b82f6;
}

.toast-message {
  flex: 1;
}

.toast-dismiss {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  margin-left: 4px;
}

.toast-dismiss:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateY(-16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
`;

/** Keeps the staff portal's reference styles isolated from the other portals. */
export default function StaffSurface({ children, page }) {
  const host = useRef(null);
  const [shadowRoot, setShadowRoot] = useState(null);

  useLayoutEffect(() => {
    setShadowRoot(
      host.current.shadowRoot || host.current.attachShadow({ mode: "open" }),
    );
  }, []);

  return (
    <div ref={host} className="staff-surface">
      {shadowRoot &&
        createPortal(
          <>
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
            />
            <link
              rel="stylesheet"
              href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
            />
            <style>{`${(pageStyles[page] || loginStyles).replaceAll(":root", ":host").replace(/(^\s*|,\s*)body(?=\s*[.{:#>+~\s])/gm, "$1:host").replaceAll("../utils/images/staff-hero-bg.png", image("staff-hero-bg.png"))}\n:host { display: block; min-height: 100vh; width: 100%; }\n${sharedStyles}`}</style>
            {children}
          </>,
          shadowRoot,
        )}
    </div>
  );
}
