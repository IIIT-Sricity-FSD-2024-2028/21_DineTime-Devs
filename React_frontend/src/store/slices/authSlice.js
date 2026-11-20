import { createSlice } from "@reduxjs/toolkit";

export const initialAuthState = {
  session: null,
  generation: 0,
  profileVersion: 0,
  error: "",
};
const authSlice = createSlice({
  name: "auth",
  initialState: initialAuthState,
  reducers: {
    signedIn(state, { payload }) {
      const { password_hash, ...user } = payload.user;
      state.session = { access_token: payload.access_token, user };
      state.generation += 1;
      state.profileVersion = 0;
      state.error = "";
    },
    signedOut(state, { payload = "" }) {
      state.session = null;
      state.generation += 1;
      state.profileVersion = 0;
      state.error = payload;
    },
    profileUpdated(state, { payload }) {
      if (!state.session || payload.generation !== state.generation) return;
      if (payload.version !== undefined && payload.version !== state.profileVersion) return;
      const { password_hash, id, role, status, ...fields } = payload.user;
      Object.assign(state.session.user, fields);
      state.profileVersion += 1;
    },
    preferencesUpdated(state, { payload }) {
      if (state.session) state.session.preferences = payload;
    },
  },
});
export const authActions = authSlice.actions;
export default authSlice.reducer;
export const selectSession = (state) => state.auth.session;
export const selectUser = (state) => state.auth.session?.user || null;
export const selectScope = (state) => state.auth.generation;
