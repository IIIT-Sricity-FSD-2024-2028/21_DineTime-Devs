const TAB_KEY = "dinetime_tab_id";

export function getTabId() {
  if (!window.name) {
    window.name = `${TAB_KEY}:${crypto.randomUUID()}`;
  }
  return window.name;
}

export function bindSession(session) {
  return session ? { ...session, tab_id: getTabId() } : null;
}

export function readBoundSession(key) {
  try {
    const session = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!session || session.tab_id !== getTabId()) {
      if (session) sessionStorage.removeItem(key);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}
