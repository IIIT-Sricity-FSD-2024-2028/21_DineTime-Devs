// Mirrors diner/hooks/useDiner.js exactly — same pattern, different context/api.
import {
  createContext,
  useContext,
  useState,
  useRef,
  useSyncExternalStore,
} from "react";
import { staffApi } from "../api/staffApi.js";

export const StaffContext = createContext(null);

/** Primary hook — merges subscribed API snapshot with router context. */
export function useStaff() {
  const state = useContext(StaffContext);
  const data = useSyncExternalStore(staffApi.subscribe, staffApi.getSnapshot);
  return { ...state, ...data, api: staffApi };
}

/** Action wrapper — tracks busy/error state for async operations. */
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
