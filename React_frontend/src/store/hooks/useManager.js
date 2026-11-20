import { useData } from "./useData.js";
import { useContext, useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { NavigationContext } from "../../app/NavigationContext.jsx";
import { emptyManager } from "../api/managerApi.js";
import { createRestaurantActions } from "../actions/restaurantActions.js";

export function useManager() {
  const navigation = useContext(NavigationContext);
  const dispatch = useDispatch(),
    store = useStore();
  const auth = useSelector((state) => state.auth);
  const query = useData(
    "manager",
    { scope: auth.generation },
    {
      skip: auth.session?.user.role !== "manager",
      pollingInterval: navigation.currentPage === "reservations" ? 15000 : 0,
      skipPollingIfUnfocused: true,
    },
  );
  const storage = useMemo(
    () => createRestaurantActions(dispatch, store.getState),
    [dispatch, store],
  );
  return {
    ...navigation,
    data: query.currentData || emptyManager,
    ready: !query.isLoading && !query.isUninitialized,
    error: query.error?.message || "",
    storage,
    refresh: storage.refreshFromBackend,
  };
}
