import { createSlice } from "@reduxjs/toolkit";
const slice = createSlice({
  name: "sync",
  initialState: { revision: 0 },
  reducers: {
    changed(state) {
      state.revision += 1;
    },
  },
});
export const syncActions = slice.actions;
export default slice.reducer;
