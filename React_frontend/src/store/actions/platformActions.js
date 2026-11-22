import { fetchData } from "./dataActions.js";
import { createRequest } from "./request.js";

import { operationsActions } from "../slices/operationsSlice.js";

export function createPlatformActions(dispatch, getState) {
  const request = createRequest(dispatch, getState);
  return {
    apiRequest: async (path, options) => ({
      data: await request(path, options),
    }),
    syncAdminState: () => dispatch(fetchData("platform", { scope: getState().auth.generation })),
    addAuditLog: (message) =>
      dispatch(
        operationsActions.auditAdded({
          time: new Date().toLocaleTimeString("en-GB"),
          message,
        }),
      ),
  };
}
