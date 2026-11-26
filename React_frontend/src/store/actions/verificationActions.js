import { createRequest } from "./request.js";

export function createVerificationActions(dispatch, getState) {
  const request = createRequest(dispatch, getState);
  return {
    review: (managerId, decision, reason, reviewerId) =>
      request(`/verification/applications/${managerId}/review`, {
        method: "PATCH",
        body: { decision, reason: reason.trim(), reviewer_id: reviewerId },
      }),
  };
}
