import { createSlice } from "@reduxjs/toolkit";
import { authActions } from "./authSlice.js";

const initialState = { draft: null, confirmation: null, status: "idle" };
const slice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    draftChanged(state, { payload }) {
      state.draft = payload;
    },
    selectionChanged(state, { payload }) {
      const previous = state.draft || {};
      const next = { ...previous, ...payload };
      if (next.restaurantId !== previous.restaurantId || next.date !== previous.date) {
        next.slotId = "";
        next.tableId = "";
      } else if (next.slotId !== previous.slotId) next.tableId = "";
      next.reservation = null;
      state.draft = next;
    },
    submitted(state) {
      state.status = "pending";
    },
    failed(state) {
      state.status = "idle";
    },
    confirmed(state, { payload }) {
      state.confirmation = payload;
      state.draft = null;
      state.status = "idle";
    },
    reset() {
      return initialState;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(authActions.signedIn, (state, { payload }) => {
        const draft = state.draft;
        if (payload.user.role === "diner" && draft?.anonymous && !draft.reservation)
          return { ...initialState, draft: { ...draft, anonymous: false } };
        return initialState;
      })
      .addCase(authActions.signedOut, () => initialState),
});
export const bookingActions = slice.actions;
export default slice.reducer;
