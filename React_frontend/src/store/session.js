import { bindSession, readBoundSession, getTabId } from "../app/session.js";

export const SESSION_KEY = "dinetime_redux_session_v1";
const legacyKeys = [
  "dinetime_react_diner_session",
  "manager_session_v1",
  "manager_backend_ids_v1",
  "dinetime_react_staff_session",
  "subadmin_auth_status",
  "subadmin_access_token",
  "subadmin_tab_id",
  "subadmin_profile",
  "super_auth_status",
  "super_access_token",
  "super_tab_id",
  "super_admin_profile",
];
export const browserSession = {
  read() {
    if (typeof window === "undefined") return null;
    const saved = readBoundSession(SESSION_KEY);
    if (saved?.access_token && saved.user?.role) return saved;
    const path = window.location.pathname;
    const key = path.startsWith("/restaurant-staff")
      ? "dinetime_react_staff_session"
      : path.startsWith("/manager")
        ? "manager_session_v1"
        : "dinetime_react_diner_session";
    const legacy = readBoundSession(key);
    if (legacy?.access_token && legacy.user?.role) return legacy;
    // Old manager sessions contain only email and token; hydration resolves the ID.
    if (key === "manager_session_v1" && legacy?.access_token)
      return {
        access_token: legacy.access_token,
        user: { email: legacy.email, role: "manager", status: "active" },
      };
    const prefix = path.startsWith("/super-admin")
      ? "super"
      : path.startsWith("/sub-admin")
        ? "subadmin"
        : "";
    if (prefix && sessionStorage.getItem(`${prefix}_tab_id`) === getTabId()) {
      const user = readBoundSession(
        prefix === "super" ? "super_admin_profile" : "subadmin_profile",
      );
      const access_token = sessionStorage.getItem(`${prefix}_access_token`);
      if (user?.role && access_token) return { user, access_token };
    }
    return null;
  },
  write(session) {
    if (typeof window === "undefined") return;
    try {
      legacyKeys.forEach((key) => sessionStorage.removeItem(key));
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(bindSession(session)));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* An in-memory session remains usable when browser storage is unavailable. */
    }
  },
};
