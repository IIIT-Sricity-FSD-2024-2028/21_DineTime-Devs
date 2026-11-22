import { baseQuery, messageOf } from "../api/baseQuery.js";
import { syncActions } from "../slices/syncSlice.js";
export const sendRequest =
  (path, options = {}, expectedScope) =>
  async (dispatch, getState, extra) => {
    const scope = expectedScope ?? getState().auth.generation;
    if (options.signal?.aborted) throw new Error("Request aborted");
    const { forceRefetch, ...requestOptions } = options;
    const result = await baseQuery(
      { path, ...requestOptions, scope },
      { dispatch, getState, extra },
    );
    if (scope !== getState().auth.generation)
      throw Object.assign(new Error(getState().auth.error || "This session has changed."), {
        status: "STALE_SESSION",
      });
    if (result.error) throw Object.assign(new Error(messageOf(result.error)), result.error);
    if (options.method && options.method !== "GET" && !path.endsWith("/auth/login"))
      dispatch(syncActions.changed());
    return result.data;
  };
export function createRequest(dispatch, getState, expectedScope) {
  return (path, options) => dispatch(sendRequest(path, options, expectedScope));
}
