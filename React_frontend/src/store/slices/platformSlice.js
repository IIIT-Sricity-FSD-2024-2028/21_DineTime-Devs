import { createSlice } from "@reduxjs/toolkit";
import { authActions } from "./authSlice.js";
const initialState = { entries: {} };
const slice = createSlice({
  name: "platform",
  initialState,
  reducers: {
    fetchStarted(state, { payload }) {
      const previous = state.entries[payload.key];
      state.entries[payload.key] = {
        ...previous,
        status: "pending",
        loading: true,
        error: null,
        requestId: payload.requestId,
      };
    },
    dataReceived(state, { payload }) {
      if (state.entries[payload.key]?.requestId !== payload.requestId) return;
      state.entries[payload.key] = {
        data: payload.data,
        status: "fulfilled",
        loading: false,
        error: null,
      };
    },
    fetchFailed(state, { payload }) {
      const entry = state.entries[payload.key];
      if (entry?.requestId !== payload.requestId) return;
      entry.status = "rejected";
      entry.loading = false;
      entry.error = payload.error;
    },
    reset() {
      return initialState;
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(authActions.signedIn, () => initialState)
      .addCase(authActions.signedOut, () => initialState),
});
export const platformActions = slice.actions;
export default slice.reducer;
