import {
  createContext,
  useContext,
  useState,
  useRef,
  useSyncExternalStore,
} from "react";
import { dinerApi } from "../api/dinerApi.js";

export const DinerContext = createContext(null);

export function useDiner() {
  const state = useContext(DinerContext);
  const data = useSyncExternalStore(dinerApi.subscribe, dinerApi.getSnapshot);
  return { ...state, ...data, api: dinerApi };
}

export function useAction() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (cause) {
      setError(cause.message || "Something went wrong. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
