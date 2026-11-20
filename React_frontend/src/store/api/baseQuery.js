import { authActions } from "../slices/authSlice.js";

export const API_BASE = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_BASE ||
  "http://localhost:3000"
).replace(/\/$/, "");
export const messageOf = (error) =>
  error?.data?.message || error?.message || error?.error || "Unable to complete the request.";
export async function baseQuery(args, api) {
  const { path, method = "GET", body, headers: supplied = {}, scope, signal, role, ...rest } = args;
  const auth = api.getState().auth;
  if (scope !== undefined && scope !== auth.generation)
    return {
      error: { status: "STALE_SESSION", message: "This session has changed." },
    };
  const generation = auth.generation;
  const credentialCheck = /\/(auth|sub-admin|super-admin)\/login$/.test(path);
  const token = credentialCheck ? null : auth.session?.access_token;
  const multipart = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = {
    ...(!multipart ? { "Content-Type": "application/json" } : {}),
    ...(auth.session?.user?.role ? { role: auth.session.user.role } : {}),
    ...supplied,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (credentialCheck) delete headers.Authorization;
  const requestBody =
    body === undefined
      ? undefined
      : multipart || typeof body === "string"
        ? body
        : JSON.stringify(body);
  try {
    const response = await (api.extra?.fetch || globalThis.fetch)(
      `${api.extra?.baseUrl || API_BASE}${path}`,
      {
        ...rest,
        method,
        headers,
        body: requestBody,
        signal: signal || api.signal,
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && token && generation === api.getState().auth.generation)
        api.dispatch(
          authActions.signedOut(
            "Your session is no longer valid. Please sign in again to continue.",
          ),
        );
      let message = Array.isArray(payload?.message)
        ? payload.message.join(", ")
        : payload?.message || `Request failed (${response.status})`;
      if (
        credentialCheck &&
        response.status === 401 &&
        /invalid.*credential|invalid.*password|invalid.*email/i.test(message)
      )
        message = "Invalid credentials";
      return { error: { status: response.status, message } };
    }
    if (generation !== api.getState().auth.generation)
      return {
        error: {
          status: "STALE_SESSION",
          message: "This session has changed.",
        },
      };
    return { data: payload?.data ?? payload };
  } catch (error) {
    return { error: { status: "FETCH_ERROR", message: error.message } };
  }
}

// Aggregate portal queries use this transport; their result is dispatched into the domain slice.
export function queryRequest(api, scope) {
  return async (path, options = {}) => {
    const result = await baseQuery({ path, ...options, scope }, api);
    if (result.error) throw Object.assign(new Error(messageOf(result.error)), result.error);
    return result.data;
  };
}
