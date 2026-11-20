import { authActions } from "../slices/authSlice.js";
import { createRequest } from "./request.js";

export const signOut =
  (message = "") =>
  (dispatch) =>
    dispatch(authActions.signedOut(message));
export const signIn = (credentials, expectedRole) => async (dispatch, getState) => {
  const request = createRequest(dispatch, getState);
  const auth = await request("/auth/login", {
    method: "POST",
    body: {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    },
  });
  const user = auth?.user;
  if (!auth?.access_token || !user?.role)
    throw new Error("The server returned an incomplete login session.");
  if (expectedRole && user.role !== expectedRole)
    throw new Error(`Please sign in with a ${expectedRole} account.`);
  if (user.status !== "active") throw new Error("Your account is not active yet.");
  const team = {
    support_admin: "support",
    finance_admin: "finance",
    verification_admin: "verification",
  }[user.role];
  dispatch(
    authActions.signedIn({
      ...auth,
      user: {
        ...user,
        ...(team ? { team } : {}),
        ...(user.restaurant_id ? { restaurantId: user.restaurant_id } : {}),
      },
    }),
  );
  const generation = getState().auth.generation;
  if (user.role === "staff") {
    try {
      const [profile, restaurants] = await Promise.all([
        request(`/users/${user.id}`),
        request("/restaurants"),
      ]);
      const restaurant = restaurants.find((item) => item.id === profile.restaurant_id);
      if (!restaurant)
        throw new Error("This staff account is not assigned to an active restaurant.");
      dispatch(
        authActions.profileUpdated({
          generation,
          user: {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
          },
        }),
      );
    } catch (error) {
      if (getState().auth.generation === generation) dispatch(signOut());
      throw error;
    }
  }
  return {
    ...getState().auth.session?.user,
    resumeBooking: user.role === "diner" && !!getState().booking.draft,
  };
};
