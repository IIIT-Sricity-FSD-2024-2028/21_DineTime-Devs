import { useMemo } from "react";
import { useDispatch, useStore } from "react-redux";

// Bind a domain's commands once; components keep form and modal state locally.
export function useActions(createActions) {
  const dispatch = useDispatch(),
    store = useStore();
  return useMemo(() => createActions(dispatch, store.getState), [createActions, dispatch, store]);
}
