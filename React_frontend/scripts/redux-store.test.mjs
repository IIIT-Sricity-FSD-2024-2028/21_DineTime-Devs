import { createDinerActions } from "../src/store/actions/dinerActions.js";
import { fetchData, selectData } from "../src/store/actions/dataActions.js";
import { authActions as resetAuth } from "../src/store/slices/authSlice.js";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createAppStore } from "../src/store/store.js";
import { authActions } from "../src/store/slices/authSlice.js";
import { bookingActions } from "../src/store/slices/bookingSlice.js";
import { operationsActions } from "../src/store/slices/operationsSlice.js";
import { completeBooking } from "../src/store/actions/bookingActions.js";
import { createRequest } from "../src/store/actions/request.js";
import { createSupportActions } from "../src/store/actions/supportActions.js";
import { createVerificationActions } from "../src/store/actions/verificationActions.js";
import { createFinanceActions } from "../src/store/actions/financeActions.js";

const session = {
  access_token: "test-token",
  user: { id: "diner", role: "diner", status: "active" },
};
const draft = { restaurantId: "r1", slotId: "s1", tableId: "t1", guests: 2 };
const stores = [];
const response = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => (status < 400 ? { data } : { message: data }),
});
function fixture(fetch) {
  const store = createAppStore({
    fetch,
    session: { read: () => session, write() {} },
  });
  stores.push(store);
  return store;
}
afterEach(() => stores.splice(0).forEach((store) => store.dispatch(resetAuth.signedOut())));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("handwritten fetch thunks share pending reads and store success/error state", async () => {
  let release;
  const store = fixture(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const args = { path: "/reservations" };
  const first = store.dispatch(fetchData("resources", args));
  const second = store.dispatch(fetchData("resources", args));
  assert.equal(first, second);
  assert.equal(selectData(store.getState(), "resources", args).loading, true);
  release(response([{ id: "r1" }]));
  await first;
  assert.equal(selectData(store.getState(), "resources", args).data[0].id, "r1");
});

test("failed writes preserve loaded data", async () => {
  const store = fixture(async (_url, options) =>
    options.method === "PATCH" ? response("Conflict", 409) : response([{ id: "r1" }]),
  );
  await store.dispatch(fetchData("resources", { path: "/reservations" }));
  await assert.rejects(
    createRequest(store.dispatch, store.getState)("/reservations/r1", {
      method: "PATCH",
      body: {},
    }),
    /Conflict/,
  );
  assert.equal(
    selectData(store.getState(), "resources", { path: "/reservations" }).data[0].id,
    "r1",
  );
});

test("logout clears private queries, booking and staff selections before another role signs in", async () => {
  const store = fixture(async () => response([{ id: "private-record" }]));
  await store.dispatch(fetchData("resources", { path: "/support/tickets" }));
  store.dispatch(bookingActions.draftChanged(draft));
  store.dispatch(operationsActions.serviceSelected({ date: "2030-01-01", slotId: "s1" }));
  store.dispatch(authActions.signedOut());
  assert.deepEqual(store.getState().resources.entries, {});
  assert.equal(store.getState().booking.draft, null);
  assert.equal(store.getState().operations.slotId, "");
  store.dispatch(
    authActions.signedIn({
      access_token: "manager-token",
      user: { id: "manager", role: "manager" },
    }),
  );
  const old = createRequest(store.dispatch, store.getState, 0);
  await assert.rejects(old("/reservations"), /session has changed/);
  assert.equal(store.getState().auth.session.user.role, "manager");
});

test("checkout blocks duplicate clicks and keeps sensitive card input out of the request", async () => {
  let release;
  const requests = [];
  const store = fixture(async (url, options) => {
    requests.push({
      path: new URL(url).pathname,
      body: JSON.parse(options.body || "null"),
    });
    if (url.endsWith("/reservations"))
      return new Promise((resolve) => {
        release = () => resolve(response({ id: "booking" }));
      });
    return response({ id: "payment", payment_status: "paid", amount: 140 });
  });
  const first = store.dispatch(completeBooking({ booking: draft, method: "card" }));
  await store.dispatch(completeBooking({ booking: draft, method: "card" }));
  assert.equal(requests.length, 1);
  release();
  const result = await first;
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.amount, undefined);
  assert.equal(requests[1].body.card, undefined);
  assert.equal(result.payment.amount, 140);
  assert.equal(store.getState().booking.draft, null);
  assert.equal(store.getState().booking.confirmation.reservation.id, "booking");
});

test("payment failure retains the reservation for retry without deleting a reused booking", async () => {
  const paths = [];
  const store = fixture(async (url, options) => {
    paths.push(options.method + " " + new URL(url).pathname);
    return url.endsWith("/payments")
      ? response("Payment declined", 400)
      : response({ id: "booking" });
  });
  await assert.rejects(
    store.dispatch(completeBooking({ booking: draft, method: "upi" })),
    /Payment declined/,
  );
  assert.deepEqual(paths, ["POST /reservations", "POST /payments"]);
  assert.equal(store.getState().booking.draft.reservation.id, "booking");
  assert.equal(store.getState().booking.status, "idle");
  paths.length = 0;
  await assert.rejects(
    store.dispatch(
      completeBooking({
        booking: { ...draft, reservation: { id: "existing" } },
        method: "upi",
      }),
    ),
    /Payment declined/,
  );
  assert.deepEqual(paths, ["POST /payments"]);
});

test("failed payment retains the reservation and retry pays it without creating a duplicate", async () => {
  let retry = false;
  const paths = [];
  const store = fixture(async (url, options) => {
    paths.push(options.method + " " + new URL(url).pathname);
    if (options.method === "DELETE") return response("Network unavailable", 503);
    if (url.endsWith("/payments"))
      return retry
        ? response({ id: "payment", payment_status: "paid" })
        : response("Declined", 400);
    return response({ id: "booking" });
  });
  await assert.rejects(
    store.dispatch(completeBooking({ booking: draft, method: "upi" })),
    /Declined/,
  );
  assert.equal(store.getState().booking.draft.reservation.id, "booking");
  retry = true;
  await store.dispatch(completeBooking({ booking: draft, method: "upi" }));
  assert.equal(paths.filter((path) => path === "POST /reservations").length, 1);
});

test("additional payment never creates or deletes the existing reservation", async () => {
  const paths = [];
  const store = fixture(async (url, options) => {
    paths.push(options.method + " " + new URL(url).pathname);
    return response("Table unavailable", 409);
  });
  await assert.rejects(
    store.dispatch(
      completeBooking({
        booking: { ...draft, reservation: { id: "existing" } },
        method: "upi",
        additional: true,
      }),
    ),
    /Table unavailable/,
  );
  assert.deepEqual(paths, ["POST /payments/additional"]);
  assert.equal(store.getState().booking.confirmation, null);
});

test("logout during checkout cannot confirm a payment or clear another user's booking", async () => {
  let finish;
  const store = fixture(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = store.dispatch(completeBooking({ booking: draft, method: "upi" }));
  const rejected = assert.rejects(pending, /session has changed/);
  store.dispatch(authActions.signedOut());
  store.dispatch(
    authActions.signedIn({
      access_token: "next",
      user: { id: "other", role: "diner" },
    }),
  );
  store.dispatch(bookingActions.draftChanged({ ...draft, tableId: "other-table" }));
  finish(response({ id: "stale" }));
  await rejected;
  assert.equal(store.getState().booking.confirmation, null);
  assert.equal(store.getState().booking.draft.tableId, "other-table");
});

test("selection changes discard dependent slots and tables", () => {
  const store = fixture(async () => response({}));
  store.dispatch(bookingActions.draftChanged({ ...draft, date: "2030-01-01" }));
  store.dispatch(bookingActions.selectionChanged({ date: "2030-01-02" }));
  assert.equal(store.getState().booking.draft.slotId, "");
  assert.equal(store.getState().booking.draft.tableId, "");
});

test("support, verification and finance commands send the expected payload with the current session token", async () => {
  const calls = [];
  const store = fixture(async (url, options) => {
    calls.push({
      path: new URL(url).pathname,
      headers: options.headers,
      body: JSON.parse(options.body),
    });
    return response({ id: "record" });
  });
  const support = createSupportActions(store.dispatch, store.getState),
    verification = createVerificationActions(store.dispatch, store.getState),
    finance = createFinanceActions(store.dispatch, store.getState);
  for (const [role, command] of [
    ["support_admin", () => support.claim("ticket", "support")],
    [
      "verification_admin",
      () => verification.review("manager", "approved", " Checked ", "verifier"),
    ],
    ["finance_admin", () => finance.decideRefund("ticket", true, " Checked ", "finance")],
  ]) {
    store.dispatch(authActions.signedIn({ access_token: role, user: { id: role, role } }));
    await command();
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${role}`);
  }
  assert.equal(calls[0].path, "/support/tickets/ticket/claim");
  assert.equal(calls[1].body.reason, "Checked");
  assert.equal(calls[2].body.notes, "Checked");
});

test("read failures preserve previous data and expose reducer error state", async () => {
  let fail = false;
  const store = fixture(async () => (fail ? response("Offline", 503) : response([{ id: "r1" }])));
  const args = { path: "/restaurants" };
  await store.dispatch(fetchData("resources", args));
  fail = true;
  await assert.rejects(store.dispatch(fetchData("resources", args)), /Offline/);
  const state = selectData(store.getState(), "resources", args);
  assert.equal(state.data[0].id, "r1");
  assert.equal(state.loading, false);
  assert.equal(state.error.message, "Offline");
});

test("platform outages fail the refresh and retain previously loaded records", async () => {
  let fail = false;
  const store = fixture(async () =>
    fail ? response("Offline", 503) : response([{ id: "record" }]),
  );
  await store.dispatch(fetchData("platform"));
  fail = true;
  await assert.rejects(store.dispatch(fetchData("platform")), /Unable to refresh platform/);
  assert.equal(selectData(store.getState(), "platform").data.users.length, 1);
});

test("anonymous booking survives diner login while account drafts clear on account switch", () => {
  const store = fixture(async () => response([]));
  store.dispatch(authActions.signedOut());
  store.dispatch(bookingActions.draftChanged({ ...draft, anonymous: true }));
  store.dispatch(authActions.signedIn(session));
  assert.equal(store.getState().booking.draft.tableId, "t1");
  store.dispatch(authActions.signedIn({ ...session, user: { ...session.user, id: "other" } }));
  assert.equal(store.getState().booking.draft, null);
});

test("already aborted requests never call fetch", async () => {
  let calls = 0;
  const store = fixture(async () => {
    calls++;
    return response([]);
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    createRequest(store.dispatch, store.getState)("/tables", { signal: controller.signal }),
    /aborted/,
  );
  assert.equal(calls, 0);
});

test("a write during a pending read triggers a fresh read before committing data", async () => {
  let release,
    reads = 0;
  const store = fixture(async (_url, options) => {
    if (options.method === "PATCH") return response({});
    reads++;
    if (reads === 1)
      return new Promise((resolve) => {
        release = resolve;
      });
    return response([{ version: 2 }]);
  });
  const args = { path: "/restaurants/r/revenue" };
  const pending = store.dispatch(fetchData("resources", args));
  await createRequest(store.dispatch, store.getState)("/payments/p", { method: "PATCH", body: {} });
  release(response([{ version: 1 }]));
  await pending;
  assert.equal(reads, 2);
  assert.equal(selectData(store.getState(), "resources", args).data[0].version, 2);
});

test("successful cancellation remains successful when its refresh fails", async () => {
  let writes = 0;
  const store = fixture(async (_url, options) =>
    options.method === "PATCH" ? (writes++, response({ id: "r1" })) : response("Offline", 503),
  );
  await createDinerActions(store.dispatch, store.getState).cancelReservation("r1");
  assert.equal(writes, 1);
  assert.match(selectData(store.getState(), "diner").error.message, /Offline/);
});

test("an obsolete scoped fetch cannot poison the new account's loading state", async () => {
  let calls = 0;
  const store = fixture(async () => {
    calls++;
    return response([]);
  });
  store.dispatch(authActions.signedOut());
  await store.dispatch(fetchData("resources", { path: "/reservations", scope: 0 }));
  assert.deepEqual(store.getState().resources.entries, {});
  assert.equal(calls, 0);
});
