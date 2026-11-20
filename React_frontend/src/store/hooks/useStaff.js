import { useData } from "./useData.js";
import { useContext, useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { NavigationContext } from "../../app/NavigationContext.jsx";
import { emptyStaff } from "../api/staffApi.js";
import { createStaffActions } from "../actions/staffActions.js";
import { toIsoDate } from "../../apps/restaurant-staff/utils/format.js";

export function useStaff() {
  const navigation = useContext(NavigationContext);
  const dispatch = useDispatch(),
    store = useStore();
  const auth = useSelector((state) => state.auth);
  const selection = useSelector((state) => state.operations);
  const query = useData(
    "staff",
    {
      scope: auth.generation,
      date: selection.date || toIsoDate(),
      slotId: selection.slotId,
    },
    {
      skip: auth.session?.user.role !== "staff",
      pollingInterval: navigation.currentPage === "check-in" ? 15000 : 0,
      skipPollingIfUnfocused: true,
    },
  );
  const api = useMemo(() => createStaffActions(dispatch, store.getState), [dispatch, store]);
  return {
    ...navigation,
    ...(query.currentData || emptyStaff),
    api,
    user: auth.session?.user.role === "staff" ? auth.session.user : null,
    loading: query.isLoading || (!query.currentData && query.isFetching),
    error: query.error?.message || "",
  };
}
