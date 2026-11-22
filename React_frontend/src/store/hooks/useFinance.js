import { useData } from "./useData.js";
import { useSelector } from "react-redux";
import { emptyFinance } from "../api/financeApi.js";

export function useFinance() {
  const auth = useSelector((state) => state.auth);
  const query = useData(
    "finance",
    { scope: auth.generation },
    {
      skip: auth.session?.user.role !== "finance_admin",
      pollingInterval: 20000,
      skipPollingIfUnfocused: true,
    },
  );
  return {
    data: query.currentData || emptyFinance,
    refetch: query.refetch,
    error: query.error?.message || "",
  };
}
