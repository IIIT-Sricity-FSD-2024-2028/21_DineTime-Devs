import { createSlice } from "@reduxjs/toolkit";
import { authActions } from "./authSlice.js";

const initialState = { date: "", slotId: "", auditLog: [] };
const slice = createSlice({
  name: "operations",
  initialState,
  reducers: {
    serviceSelected(state, { payload }) {
      state.date = payload.date;
      state.slotId = payload.slotId || "";
    },
    auditAdded(state, { payload }) {
      state.auditLog.push(payload);
    },
  },
  extraReducers: (builder) =>
    builder
      .addCase(authActions.signedIn, () => initialState)
      .addCase(authActions.signedOut, () => initialState),
});
export const operationsActions = slice.actions;
export default slice.reducer;
