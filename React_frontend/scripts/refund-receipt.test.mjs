import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { money } from "../src/apps/diner/utils/format.js";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/app/RefundReceipt.jsx", import.meta.url), "utf8");
const { code } = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" });
const module = { exports: {} };
runInNewContext(code, { module, exports: module.exports, require });
const { RefundReceipt } = module.exports;
const ticketSource = await readFile(
  new URL("../src/apps/diner/components/TicketRefund.jsx", import.meta.url),
  "utf8",
);
const ticketModule = { exports: {} };
runInNewContext(
  transformSync(ticketSource, { loader: "jsx", format: "cjs", jsx: "automatic" }).code,
  {
    module: ticketModule,
    exports: ticketModule.exports,
    require(id) {
      if (id.includes("RefundReceipt")) return { RefundReceipt };
      if (id.includes("utils/format")) return { money };
      return require(id);
    },
  },
);
const TicketRefund = ticketModule.exports.default;

test("the shared diner/finance refund receipt displays the amount and matching audit references", () => {
  const refund = {
    id: "refund-0001",
    reservation_id: "resv-0001",
    amount: 150.35,
    processed_at: "2030-01-02T12:00:00Z",
    processed_by: "fin-0001",
    mode: "demo",
    payments: [
      { payment_id: "pay-0001", amount: 120.25 },
      { payment_id: "pay-0002", amount: 30.1 },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(RefundReceipt, { refund }));
  for (const value of [
    "₹150.35",
    "resv-0001",
    "refund-0001",
    "fin-0001",
    "pay-0001",
    "₹120.25",
    "pay-0002",
    "₹30.10",
    "Demo payment refund",
  ])
    assert.ok(html.includes(value), value);
});

test("a ticket with no recorded refund cannot display a refund receipt", () => {
  assert.equal(renderToStaticMarkup(React.createElement(RefundReceipt)), "");
});

test("My Tickets displays the actual amount for older resolved refunds without inventing a receipt", () => {
  const ticket = {
    status: "resolved",
    linked_reservation_id: "resv-0002",
    reservation_refunded_amount: 120,
  };
  const html = renderToStaticMarkup(React.createElement(TicketRefund, { ticket }));
  assert.ok(html.includes("Amount refunded: ₹120.00"));
  assert.ok(html.includes("For linked reservation resv-0002"));
  assert.ok(!html.includes("Refund ID:"));
});

test("older APIs can display the payment-backed amount from the diner reservation", () => {
  const ticket = { status: "resolved", linked_reservation_id: "resv-0002" };
  const html = renderToStaticMarkup(
    React.createElement(TicketRefund, {
      ticket,
      reservation: { payment_summary: { refunded_amount: 120 } },
    }),
  );
  assert.ok(html.includes("Amount refunded: ₹120.00"));
});

test("resolved but unpaid tickets do not claim a refund, and current receipts remain ticket-specific", () => {
  const ticket = {
    status: "resolved",
    linked_reservation_id: "resv-0002",
    reservation_refunded_amount: 0,
  };
  assert.equal(
    renderToStaticMarkup(
      React.createElement(TicketRefund, {
        ticket,
        reservation: { payment_summary: { refunded_amount: 999 } },
      }),
    ),
    "",
  );
  const refund = {
    id: "refund-0002",
    reservation_id: ticket.linked_reservation_id,
    amount: 80,
    processed_at: "2030-01-02T12:00:00Z",
    processed_by: "fin-0001",
  };
  const html = renderToStaticMarkup(
    React.createElement(TicketRefund, {
      ticket: { ...ticket, refund, reservation_refunded_amount: 120 },
    }),
  );
  assert.ok(html.includes("₹80.00"));
  assert.ok(html.includes("refund-0002"));
  assert.ok(!html.includes("₹120.00"));
});
