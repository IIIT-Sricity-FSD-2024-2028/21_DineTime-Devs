import { createRequest } from "./request.js";

export function createSupportActions(dispatch, getState) {
  const request = createRequest(dispatch, getState);
  return {
    claim: (ticketId, adminId) =>
      request(`/support/tickets/${ticketId}/claim`, {
        method: "PATCH",
        body: { admin_id: adminId },
      }),
    decide: (ticketId, decision, body) =>
      request(`/support/tickets/${ticketId}/${decision}`, {
        method: "PATCH",
        body,
      }),
  };
}
