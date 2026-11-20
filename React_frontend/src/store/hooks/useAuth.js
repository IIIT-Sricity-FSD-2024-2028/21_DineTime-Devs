import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { signIn, signOut } from "../actions/authActions.js";

export function useAuth(portal) {
  const dispatch = useDispatch();
  const session = useSelector((state) => state.auth.session);
  const role = session?.user.role;
  const matches =
    !portal ||
    (portal === "sub-admin"
      ? ["support_admin", "finance_admin", "verification_admin"].includes(role)
      : role === portal);
  const commands = useMemo(
    () => ({
      login: (email, password) => {
        const credentials = typeof email === "object" ? email : { email, password };
        const expectedRole = credentials.team ? `${credentials.team}_admin` : portal;
        return dispatch(signIn(credentials, expectedRole));
      },
      logout: () => {
        dispatch(signOut());
        window.history.pushState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
    }),
    [dispatch, portal],
  );
  return {
    ...commands,
    session,
    profile: matches ? session?.user || {} : {},
    adminId: matches ? session?.user.id || "" : "",
    isAuthenticated: !!session?.access_token && matches,
  };
}
