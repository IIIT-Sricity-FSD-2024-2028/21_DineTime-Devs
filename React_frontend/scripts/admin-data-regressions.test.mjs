import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { withRefundAmounts } from "../src/apps/sub-admin/utils/refundAmounts.js";
import { money, formatDate } from "../src/apps/sub-admin/utils/format.js";

const require = createRequire(import.meta.url);
async function load(file, mocks = {}, expose = "", globals = {}) {
  const source = await readFile(new URL(`../src/apps/${file}`, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" });
  const module = { exports: {} };
  runInNewContext(`${code}\n${expose}`, {
    module,
    exports: module.exports,
    ...globals,
    require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.endsWith(".css")) return {};
      return require(id);
    },
  });
  return module.exports;
}

test("finance derives the actual paid amount from old responses and includes modification payments", () => {
  const ticket = {
    linked_reservation_id: "resv-2",
    payment: {
      amount: 140,
      diner_platform_fee: 20,
      refunded_amount: 120,
      payment_status: "refunded",
    },
  };
  assert.equal(withRefundAmounts(ticket).total_paid_amount, 140);
  assert.equal(withRefundAmounts(ticket).refundable_amount, 0);
  assert.equal(withRefundAmounts(ticket).refund_eligible_amount, 120);
  assert.equal(withRefundAmounts(ticket).already_refunded_amount, 120);
  const audit = [
    { reservation_id: "resv-2", amount: 140, diner_platform_fee: 20, status: "paid" },
    { reservation_id: "resv-2", amount: 60.25, diner_platform_fee: 0, status: "paid" },
    { reservation_id: "other", amount: 999, status: "paid" },
    { reservation_id: "resv-2", amount: 50, status: "failed" },
  ];
  assert.equal(withRefundAmounts(ticket, audit).total_paid_amount, 200.25);
  assert.equal(withRefundAmounts(ticket, audit).refundable_amount, 180.25);
  assert.equal(withRefundAmounts(ticket, audit).diner_platform_fee_amount, 20);
  assert.equal(
    withRefundAmounts({ payment: { amount: 140, deposit_amount: 120, payment_status: "paid" } })
      .refundable_amount,
    120,
  );
  assert.equal(
    withRefundAmounts({ ...ticket, total_paid_amount: 210, refundable_amount: 10 }, audit)
      .refundable_amount,
    10,
  );
  assert.equal(withRefundAmounts({}).total_paid_amount, 0);
});

test("refund modal separates eligible amount from already returned money and disables duplicate refunds", async () => {
  const { RefundModal } = await load(
    "sub-admin/pages/finance/FinanceDashboard.jsx",
    {
      "../../api/client.js": {},
      "../../components/AdminLayout.jsx": {},
      "../../components/DataTable.jsx": {},
      "../../components/Modal.jsx": {
        Modal: ({ children }) => React.createElement("section", null, children),
      },
      "../../components/StatusBadge.jsx": { StatusBadge: () => null },
      "../../context/AuthContext.jsx": {},
      "../../context/ToastContext.jsx": {},
      "../../utils/format.js": { money, formatDate },
      "../../../../app/actions.js": {},
      "../../../../app/RefundReceipt.jsx": { RefundReceipt: () => null },
      "../../utils/refundAmounts.js": { withRefundAmounts },
    },
    "module.exports.RefundModal = RefundModal;",
  );
  function render(refunded) {
    const current = withRefundAmounts({
      id: "tkt-4",
      status: "escalated_finance_team",
      reservation: { id: "resv-2" },
      raised_by_role: "diner",
      payment: {
        amount: 140,
        diner_platform_fee: 20,
        refunded_amount: refunded,
        payment_status: refunded ? "refunded" : "paid",
      },
    });
    return renderToStaticMarkup(
      React.createElement(RefundModal, {
        current,
        notes: "",
        setNotes() {},
        close() {},
        refundDecision() {},
        busy: false,
      }),
    );
  }
  const pending = render(0);
  assert.ok(pending.includes("Approve &amp; Refund Rs.120"));
  const refunded = render(120);
  assert.match(refunded, /Refundable amount \(paid − platform fee\)<\/span><span>Rs.120/);
  assert.match(refunded, /Already refunded for this reservation<\/span><span>Rs.120/);
  assert.match(refunded, /Remaining to refund<\/span><span>Rs.0/);
  assert.match(refunded, /<button[^>]*disabled=""[^>]*>Already refunded<\/button>/);
  assert.ok(refunded.includes("Another ticket cannot refund the same payment again."));
  assert.ok(!refunded.includes("Approve &amp; Refund Rs.0"));
});

test("completed diner history and cards hide the redundant completion button but retain rating", async () => {
  const DinerContext = React.createContext(null);
  const wrapper = ({ children }) => React.createElement("div", null, children);
  const empty = () => null;
  const { default: ReservationCard, StatusBadge } = await load(
    "diner/components/ReservationCard.jsx",
    {
      "./Navigation.jsx": { Icon: empty, PageLink: wrapper },
      "../context/DinerContext.js": { DinerContext },
      "../utils/format.js": { statusLabel: (status) => status, timeLabel: (time) => time },
      "./ReservationPayment.jsx": empty,
    },
  );
  const { default: ProfilePage } = await load("diner/pages/ProfilePage.jsx", {
    "../../../app/actions.js": { createAction: () => () => {} },
    "../components/Navigation.jsx": { DinerLayout: wrapper, Icon: empty, PageLink: wrapper },
    "../components/Feedback.jsx": {
      DataState: wrapper,
      EmptyState: wrapper,
      ErrorMessage: empty,
      Modal: empty,
    },
    "../components/Fields.jsx": {},
    "../components/LocationMap.jsx": empty,
    "../components/ReservationCard.jsx": { default: ReservationCard, StatusBadge },
    "../components/ReservationDialogs.jsx": {},
    "../context/DinerContext.js": { DinerContext },
  });
  const reservation = {
    id: "completed-reservation",
    restaurant_id: "res-1",
    slot_id: "slot-1",
    guest_count: 6,
    reservation_status: "completed",
    diner_completed_at: "2030-01-02T12:00:00Z",
  };
  const value = {
    api: {},
    user: { name: "Diner" },
    reservations: [reservation],
    restaurants: [{ id: "res-1", name: "Spice Garden" }],
    slots: [{ id: "slot-1", slot_date: "2030-01-02", start_time: "18:00" }],
    reviews: [],
    tables: [],
    notifications: [],
    params: {},
  };
  const render = (child) =>
    renderToStaticMarkup(React.createElement(DinerContext.Provider, { value }, child));
  const profile = render(React.createElement(ProfilePage));
  assert.ok(profile.includes("Rate Experience"));
  assert.ok(!profile.includes("Dine Complete"));
  for (const compact of [false, true]) {
    const html = render(React.createElement(ReservationCard, { reservation, compact }));
    assert.ok(!html.includes("Dine Complete"));
    const active = render(
      React.createElement(ReservationCard, {
        reservation: {
          ...reservation,
          reservation_status: "checked_in",
          diner_completed_at: undefined,
        },
        compact,
      }),
    );
    assert.ok(active.includes("Dine Complete"));
  }
});

test("the finance requests table renders the paid amount rather than Rs.0 for the reported older API response", async () => {
  const { Refunds } = await load(
    "sub-admin/pages/finance/FinanceDashboard.jsx",
    {
      "../../api/client.js": {},
      "../../components/AdminLayout.jsx": {},
      "../../components/DataTable.jsx": {
        DataTable: ({ rows }) =>
          React.createElement("table", null, React.createElement("tbody", null, rows)),
      },
      "../../components/Modal.jsx": {},
      "../../components/StatusBadge.jsx": { StatusBadge: () => null },
      "../../context/AuthContext.jsx": {},
      "../../context/ToastContext.jsx": {},
      "../../utils/format.js": { money, formatDate },
      "../../../../app/actions.js": {},
      "../../../../app/RefundReceipt.jsx": {},
      "../../utils/refundAmounts.js": { withRefundAmounts },
    },
    "module.exports.Refunds = Refunds;",
  );
  const ticket = withRefundAmounts({
    id: "tkt-0004",
    linked_reservation_id: "resv-0002",
    payment: { amount: 140, payment_status: "refunded", refunded_amount: 120 },
  });
  const html = renderToStaticMarkup(
    React.createElement(Refunds, {
      refunds: [ticket],
      query: "",
      status: "",
      setQuery() {},
      setStatus() {},
      openRefund() {},
    }),
  );
  assert.ok(html.includes("Rs.140"));
  assert.ok(!html.includes("Rs.0"));
});

test("manager payment history hides pending rows and displays the settlement date only", async () => {
  const ManagerContext = React.createContext(null);
  const settledAt = "2030-01-02T12:00:00Z";
  const component = await load("manager/pages/RevenuePage.jsx", {
    react: {
      ...React,
      useState: (initial) => [
        initial?.payments
          ? {
              pending_payout: 60,
              paid_by_platform: 90,
              payments: [
                {
                  id: "pending-only",
                  amount: 60,
                  status: "pending_payout",
                  payment_time: "2029-01-01",
                },
                {
                  id: "settled-payment",
                  reservation_id: "resv-paid",
                  amount: 90,
                  status: "paid_out",
                  payment_time: "2029-01-01",
                  settled_at: settledAt,
                },
              ],
            }
          : initial,
        () => {},
      ],
    },
    "../components/ManagerLayout": ({ children }) => React.createElement("main", null, children),
    "../context/ManagerContext.jsx": { ManagerContext },
  });
  const html = renderToStaticMarkup(
    React.createElement(
      ManagerContext.Provider,
      { value: { storage: {}, data: {} } },
      React.createElement(component.default),
    ),
  );
  assert.ok(html.includes("settled-payment"));
  assert.ok(html.includes("resv-paid"));
  assert.ok(
    html.includes(new Date(settledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })),
  );
  assert.ok(!html.includes("pending-only"));
});

test("unified login hides role-specific invalid-credential messages from older APIs", async () => {
  const auth = await load(
    "auth/UnifiedAuthPage.jsx",
    {
      "../../app/session.js": {},
      "../manager/api/config.js": {},
      "../landing/images/restaurant-interior-hero.jpg": "",
    },
    "module.exports.authenticate = authenticate;",
    {
      fetch: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid sub-admin credentials" }),
      }),
    },
  );
  await assert.rejects(auth.authenticate("http://local", { email: "wrong", password: "wrong" }), {
    message: "Invalid credentials",
  });
});

test("super-user reservations show all service dates initially and support clearing the date filter", async () => {
  const source = await readFile(
    new URL("../src/apps/super-admin/pages/DashboardPage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /resDate: (?:''|"")/);
  const { ReservationsView } = await load(
    "super-admin/pages/DashboardPage.jsx",
    {
      "../api/client.js": {},
      "../context/AdminContext.jsx": {},
      "../context/AuthContext.jsx": {},
      "../context/ToastContext.jsx": {},
      "../utils/mappers.js": {},
    },
    "module.exports.ReservationsView = ReservationsView;",
  );
  const rows = [
    {
      id: "future-booking",
      date: "2031-01-02",
      time: "18:00",
      dinerName: "Diner",
      dinerId: "din-1",
      restaurantName: "Spice Garden",
      restaurantId: "res-1",
      party: 2,
      status: "Booking",
    },
    { id: "past-booking", date: "2025-01-01", status: "Completed" },
  ];
  const render = (date = "", error = "") =>
    renderToStaticMarkup(
      React.createElement(ReservationsView, {
        data: { reservations: rows, reservationsError: error },
        filters: { resDate: date, resType: "restaurantName", resQuery: "", resStatus: "" },
        setFilter() {},
        getReservationDisplay: (row) => row,
      }),
    );
  assert.ok(render().includes("future-booking"));
  assert.ok(render().includes("past-booking"));
  assert.ok(!render("2031-01-02").includes("past-booking"));
  assert.ok(render("2031-01-02").includes("All dates"));
  assert.ok(render("", "Unable to load reservations.").includes('role="alert"'));
});
