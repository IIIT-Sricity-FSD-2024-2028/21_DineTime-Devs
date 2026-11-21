import { useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useData } from "./useData.js";
import { createRequest } from "../actions/request.js";

export function useResource(path, options = {}) {
  const scope = useSelector((state) => state.auth.generation);
  return useData("resources", { path, scope }, options);
}

export function useApiRequest() {
  const dispatch = useDispatch(),
    store = useStore();
  return useMemo(() => {
    const request = createRequest(dispatch, store.getState);
    return async (path, options) => ({ data: await request(path, options) });
  }, [dispatch, store]);
}
