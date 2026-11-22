import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { dataKey, fetchData, selectData } from "../actions/dataActions.js";
export function useData(name, args = {}, options = {}) {
  const dispatch = useDispatch();
  const scope = useSelector((state) => state.auth.generation);
  const revision = useSelector((state) => state.sync.revision);
  const key = dataKey(args),
    skip = !!options.skip;
  const entry = useSelector((state) => selectData(state, name, args));
  const refetch = useMemo(
    () => () => {
      const task = dispatch(fetchData(name, { ...JSON.parse(key), scope }));
      return task;
    },
    [dispatch, name, key, scope],
  );
  useEffect(() => {
    if (skip) return;
    const refresh = () => {
      refetch().catch(() => {});
    };
    refresh();
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    const timer = options.pollingInterval
      ? setInterval(visibleRefresh, options.pollingInterval)
      : null;
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      if (timer) clearInterval(timer);
    };
  }, [refetch, skip, revision, options.pollingInterval]);
  const current = skip ? undefined : entry;
  return {
    data: current?.data,
    currentData: current?.data,
    error: current?.error,
    isLoading: !skip && !current?.data && current?.status !== "rejected",
    isFetching: !skip && current?.loading,
    isUninitialized: !current,
    refetch,
  };
}
