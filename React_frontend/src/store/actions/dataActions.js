// Handwritten async thunks: fetch, then dispatch synchronous slice reducers.
import { baseQuery, messageOf } from "../api/baseQuery.js";
import { loadDinerData } from "../api/dinerApi.js";
import { dinerActions } from "../slices/dinerSlice.js";
import { loadManagerData } from "../api/managerApi.js";
import { managerActions } from "../slices/managerSlice.js";
import { loadStaffData } from "../api/staffApi.js";
import { staffActions } from "../slices/staffSlice.js";
import { loadPlatformData } from "../api/platformApi.js";
import { platformActions } from "../slices/platformSlice.js";
import { loadFinanceData } from "../api/financeApi.js";
import { financeActions } from "../slices/financeSlice.js";
import { resourcesActions } from "../slices/resourcesSlice.js";
const loaders = {
  diner: (api, args) => loadDinerData(api, args.scope),
  manager: (api, args) => loadManagerData(api, args.scope),
  staff: (api, args) => loadStaffData(api, args),
  platform: (api, args) => loadPlatformData(api, args.scope),
  finance: (api, args) => loadFinanceData(api, args.scope),
};
const reducers = {
  diner: dinerActions,
  manager: managerActions,
  staff: staffActions,
  platform: platformActions,
  finance: financeActions,
  resources: resourcesActions,
};
const pendingByStore = new WeakMap();
let sequence = 0;
export const dataKey = (args = {}) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(args)
        .filter(([key]) => key !== "scope")
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
export const selectData = (state, name, args = {}) => state[name].entries[dataKey(args)];
export const fetchData =
  (name, args = {}) =>
  (dispatch, getState, extra) => {
    const scope = args.scope ?? getState().auth.generation;
    if (scope !== getState().auth.generation) return Promise.resolve(undefined);
    const key = dataKey(args),
      requestKey = `${scope}:${name}:${key}`;
    let pending = pendingByStore.get(getState);
    if (!pending) {
      pending = new Map();
      pendingByStore.set(getState, pending);
    }
    if (pending.has(requestKey)) return pending.get(requestKey);
    const requestId = ++sequence,
      actions = reducers[name];
    const revision = getState().sync.revision;
    dispatch(actions.fetchStarted({ key, requestId }));
    const task = (async () => {
      try {
        const api = { dispatch, getState, extra };
        let data;
        if (name === "resources") {
          const result = await baseQuery({ path: args.path, scope }, api);
          if (result.error) throw Object.assign(new Error(messageOf(result.error)), result.error);
          data = result.data;
        } else data = await loaders[name](api, { ...args, scope });
        if (scope !== getState().auth.generation) return undefined;
        if (revision !== getState().sync.revision) {
          pending.delete(requestKey);
          return await dispatch(fetchData(name, args));
        }
        dispatch(actions.dataReceived({ key, requestId, data }));
        return data;
      } catch (error) {
        if (scope !== getState().auth.generation) return undefined;
        dispatch(
          actions.fetchFailed({
            key,
            requestId,
            error: { message: messageOf(error), status: error.status },
          }),
        );
        throw error;
      } finally {
        if (pending.get(requestKey) === task) pending.delete(requestKey);
      }
    })();
    pending.set(requestKey, task);
    return task;
  };
