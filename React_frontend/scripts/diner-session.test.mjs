import { fetchData, selectData } from "../src/store/actions/dataActions.js";
import { authActions as resetAuth } from "../src/store/slices/authSlice.js";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createAppStore } from "../src/store/store.js";
import { createDinerActions } from "../src/store/actions/dinerActions.js";
import { SESSION_KEY as sessionKey } from "../src/store/session.js";
const user = {
  id: "diner-test",
  role: "diner",
  status: "active",
  name: "Test Diner",
};
const initialSession = () => ({
  access_token: "test-token",
  user: { ...user },
});
const stores = [];
afterEach(() => stores.splice(0).forEach((store) => store.dispatch(resetAuth.signedOut())));

// Exercise the real reducers, middleware, handwritten thunk transport and action layer.
function client(fetch, seed = initialSession()) {
  const stored = new Map(seed ? [[sessionKey, JSON.stringify(seed)]] : []);
  const store = createAppStore({
    fetch,
    session: {
      read: () => seed,
      write: (session) =>
        session ? stored.set(sessionKey, JSON.stringify(session)) : stored.delete(sessionKey),
    },
  });
  stores.push(store);
  const api = createDinerActions(store.dispatch, store.getState);
  api.getSnapshot = () => ({
    user: store.getState().auth.session?.user || null,
    sessionError: store.getState().auth.error,
    loading: selectData(store.getState(), "diner")?.status === "pending",
  });
  return { api, stored, store };
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test("permission denial does not log out an authenticated diner", async () => {
  const { api, stored } = client(async () =>
    response(403, { message: "Role is not allowed for this resource" }),
  );
  await assert.rejects(api.request("/reviews"), /Role is not allowed/);
  assert.equal(api.getSnapshot().user.id, user.id);
  assert.equal(stored.has(sessionKey), true);
});

test("a current-session 401 logs out and provides a visible explanation", async () => {
  const { api, stored } = client(async () =>
    response(401, { message: "Invalid or expired token" }),
  );
  await assert.rejects(api.request("/reservations"), /session is no longer valid/);
  assert.equal(api.getSnapshot().user, null);
  assert.equal(stored.has(sessionKey), false);
  assert.match(api.getSnapshot().sessionError, /Please sign in again/);
});

test("a delayed unauthorized response cannot erase a newer login", async () => {
  let finishOldRequest;
  const { api } = client(async (path) => {
    if (path.endsWith("/auth/login")) return response(200, { data: initialSession() });
    return new Promise((resolve) => {
      finishOldRequest = resolve;
    });
  });
  const oldRequest = api.request("/notifications");
  // Even when a new login issues the same token, its version must be protected.
  await api.login("test@example.test", "test-only-password");
  finishOldRequest(response(401, { message: "Invalid or expired token" }));
  await assert.rejects(oldRequest, /session has changed/);
  assert.equal(api.getSnapshot().user.id, user.id);
  assert.equal(api.getSnapshot().sessionError, "");
});

test("an unsuccessful credential check preserves the existing login", async () => {
  let sentHeaders;
  const { api } = client(async (_url, options) => {
    sentHeaders = options.headers;
    return response(401, { message: "Invalid credentials" });
  });
  await assert.rejects(
    api.login("test@example.test", "incorrect-test-password"),
    /Invalid credentials/,
  );
  assert.equal(sentHeaders.Authorization, undefined);
  assert.equal(api.getSnapshot().user.id, user.id);
});

test("an old refresh cannot overwrite a newly authenticated profile", async () => {
  let finishProfile, reachedProfile;
  const profileStarted = new Promise((resolve) => {
    reachedProfile = resolve;
  });
  const seed = {
    ...initialSession(),
    user: { ...user, location_id: "loc-test" },
  };
  const { api } = client(async (url) => {
    const path = new URL(url).pathname;
    if (path === "/auth/login")
      return response(200, {
        data: { ...initialSession(), user: { ...user, name: "New Profile" } },
      });
    if (path === "/users/diner-test") {
      reachedProfile();
      return new Promise((resolve) => {
        finishProfile = resolve;
      });
    }
    return response(200, {
      data: path === "/restaurants/locations" ? [{ id: "loc-test" }] : [],
    });
  }, seed);
  const oldRefresh = api.refresh();
  await profileStarted;
  await api.login("test@example.test", "test-only-password");
  finishProfile(response(200, { data: { ...user, name: "Old Profile" } }));
  await oldRefresh;
  assert.equal(api.getSnapshot().user.name, "New Profile");
  assert.equal(api.getSnapshot().loading, false);
});

test("network and server failures preserve the login", async () => {
  for (const failure of [
    async () => {
      throw new Error("Network error");
    },
    async () => response(500, { message: "Server error" }),
  ]) {
    const { api } = client(failure);
    await assert.rejects(api.request("/restaurants"), /error/);
    assert.equal(api.getSnapshot().user.id, user.id);
  }
});

test("successful login clears the expiry message and explicit logout stays silent", async () => {
  const { api } = client(async () => response(200, { data: initialSession() }));
  api.logout("Please sign in again");
  await api.login("test@example.test", "test-only-password");
  assert.equal(api.getSnapshot().sessionError, "");
  api.logout();
  assert.equal(api.getSnapshot().user, null);
  assert.equal(api.getSnapshot().sessionError, "");
});

test("settings can save a whole account without sending identity or permission fields", async () => {
  let body;
  const { api } = client(async (_url, options) => {
    body = JSON.parse(options.body);
    return response(200, {
      data: { ...user, city: "Bengaluru", country: "India" },
    });
  });
  await api.updateProfile({
    ...user,
    city: "Banglore",
    country: "India",
    created_at: "old",
    latitude: null,
    longitude: null,
  });
  assert.deepEqual(body, {
    name: user.name,
    city: "Banglore",
    country: "India",
    latitude: null,
    longitude: null,
  });
  assert.equal(api.getSnapshot().user.city, "Bengaluru");
  assert.equal(api.getSnapshot().user.id, user.id);
});

test("a background profile read cannot undo a city saved from settings", async () => {
  let finishProfile, reachedProfile;
  const started = new Promise((resolve) => {
    reachedProfile = resolve;
  });
  // Profile hydration runs only for a diner with a saved location.
  const seed = {
    ...initialSession(),
    user: { ...user, location_id: "loc-test" },
  };
  let saved = false;
  const { api } = client(async (url, options) => {
    if (new URL(url).pathname === "/users/diner-test") {
      if (options.method === "PATCH") {
        saved = true;
        return response(200, { data: { ...user, city: "Delhi" } });
      }
      if (saved) return response(200, { data: { ...user, city: "Delhi" } });
      reachedProfile();
      return new Promise((resolve) => {
        finishProfile = resolve;
      });
    }
    return response(200, { data: [] });
  }, seed);
  const refresh = api.refresh();
  await started;
  await api.updateProfile({ city: "Delhi" });
  finishProfile(response(200, { data: { ...user, city: "Bengaluru" } }));
  await refresh;
  assert.equal(api.getSnapshot().user.city, "Delhi");
  assert.equal(api.getSnapshot().loading, false);
});

test("a delayed settings save cannot overwrite another login", async () => {
  let finishSave;
  const { api } = client(async (url) => {
    if (url.endsWith("/auth/login"))
      return response(200, {
        data: {
          access_token: "new-token",
          user: { ...user, id: "another-diner" },
        },
      });
    return new Promise((resolve) => {
      finishSave = resolve;
    });
  });
  const save = api.updateProfile({ city: "Delhi" });
  await api.login("another@example.test", "test-only-password");
  finishSave(response(200, { data: { ...user, city: "Delhi" } }));
  await assert.rejects(save, /session has changed/);
  assert.equal(api.getSnapshot().user.id, "another-diner");
});
