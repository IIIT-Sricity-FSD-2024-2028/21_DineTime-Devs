import { configureStore } from "@reduxjs/toolkit";

import auth, { initialAuthState } from "./slices/authSlice.js";
import booking from "./slices/bookingSlice.js";
import operations from "./slices/operationsSlice.js";
import diner from "./slices/dinerSlice.js";
import manager from "./slices/managerSlice.js";
import staff from "./slices/staffSlice.js";
import platform from "./slices/platformSlice.js";
import finance from "./slices/financeSlice.js";
import resources from "./slices/resourcesSlice.js";
import sync from "./slices/syncSlice.js";
import { browserSession } from "./session.js";

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /password|token|authorization/i.test(key) ? "[redacted]" : redact(item),
      ]),
    );
  return value;
}
export function createAppStore({ session = browserSession, fetch, baseUrl, preloadedState } = {}) {
  const sessionMiddleware = (api) => (next) => (action) => {
    const before = api.getState().auth;
    const result = next(action);
    const after = api.getState().auth;
    if (before !== after) session.write(after.session);

    return result;
  };
  return configureStore({
    reducer: {
      auth,
      booking,
      operations,
      diner,
      manager,
      staff,
      platform,
      finance,
      resources,
      sync,
    },
    preloadedState: {
      auth: { ...initialAuthState, session: session.read() },
      ...preloadedState,
    },
    middleware: (defaults) =>
      defaults({ thunk: { extraArgument: { fetch, baseUrl } } }).concat(sessionMiddleware),
    devTools: { actionSanitizer: redact, stateSanitizer: redact },
  });
}
export const store = createAppStore();
