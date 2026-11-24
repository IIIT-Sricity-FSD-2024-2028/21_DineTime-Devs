import { createRequest } from "./request.js";

export function createFinanceActions(dispatch, getState) {
  const request = createRequest(dispatch, getState);
  return {
    decideRefund: (id, approve, notes, adminId) =>
      request(`/finance/refunds/${id}/decision`, {
        method: "PATCH",
        body: { approve, notes: notes.trim(), admin_id: adminId },
      }),
    setBlocked: (path, blocked, adminId) =>
      request(path, { method: "PATCH", body: { blocked, admin_id: adminId } }),
    settleAll: (adminId) =>
      request("/finance/payouts/settle-all", {
        method: "POST",
        body: { admin_id: adminId },
      }),
  };
}
