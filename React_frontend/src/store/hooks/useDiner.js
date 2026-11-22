import { useData } from "./useData.js";
import { useContext, useMemo } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { NavigationContext } from "../../app/NavigationContext.jsx";
import { emptyDiner } from "../api/dinerApi.js";
import { createDinerActions } from "../actions/dinerActions.js";
import { bookingActions } from "../slices/bookingSlice.js";
import { completeBooking } from "../actions/bookingActions.js";

export function useDiner() {
  const navigation = useContext(NavigationContext);
  const dispatch = useDispatch(),
    store = useStore();
  const auth = useSelector((state) => state.auth);
  const booking = useSelector((state) => state.booking);
  const query = useData(
    "diner",
    { scope: auth.generation },
    { skip: !!auth.session && auth.session.user.role !== "diner" },
  );
  const api = useMemo(() => createDinerActions(dispatch, store.getState), [dispatch, store]);
  const commands = useMemo(
    () => ({
      setBooking: (value) => {
        const draft = typeof value === "function" ? value(store.getState().booking.draft) : value;
        return dispatch(
          bookingActions.draftChanged(
            draft ? { ...draft, anonymous: !store.getState().auth.session } : null,
          ),
        );
      },
      setConfirmation: (value) => dispatch(bookingActions.confirmed(value)),
      completeBooking: (values) => dispatch(completeBooking(values)),
    }),
    [dispatch, store],
  );
  return {
    ...navigation,
    ...(query.currentData || emptyDiner),
    api,
    ...commands,
    user: auth.session?.user.role === "diner" ? auth.session.user : null,
    sessionError: auth.error,
    loading: query.isLoading || (!query.currentData && query.isFetching),
    error: query.error?.message || "",
    booking: booking.draft,
    confirmation: booking.confirmation,
  };
}
