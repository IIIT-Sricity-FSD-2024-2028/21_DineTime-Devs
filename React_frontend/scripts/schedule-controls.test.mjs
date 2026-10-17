import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";

const require = createRequire(import.meta.url);
const ManagerContext = React.createContext(null);
const ToastContext = React.createContext(null);

async function loadComponent(file, expose = "") {
  const source = await readFile(
    new URL(`../src/apps/manager/components/${file}`, import.meta.url),
    "utf8",
  );
  const { code } = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" });
  const module = { exports: {} };
  runInNewContext(`${code}\n${expose}`, {
    module,
    exports: module.exports,
    require(id) {
      if (id.includes("ManagerContext")) return { ManagerContext };
      if (id.includes("ToastContext")) return { ToastContext };
      if (id.includes("ManagerLayout"))
        return ({ children }) => React.createElement("main", null, children);
      if (id.includes("SessionModal")) return () => null;
      if (id.includes("indiaTime"))
        return { indiaToday: () => "2030-01-02", isPastSlot: () => false };
      if (id.includes("actions")) return { createAction: () => () => {} };
      if (id.includes("sessions")) return { arrangeLayout: (tables) => tables };
      if (id.endsWith(".css")) return {};
      return require(id);
    },
  });
  return module.exports;
}

const { default: ServicePlanner } = await loadComponent("ServicePlanner.jsx");
const { TableBoxes } = await loadComponent(
  "DiningRoom.jsx",
  "module.exports.TableBoxes = TableBoxes;",
);
const windows = [
  { start_time: "18:00", end_time: "20:00" },
  { start_time: "20:00", end_time: "22:00" },
];
function plannerHtml(slots = windows, records = []) {
  const weekly = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    open_time: "11:00",
    close_time: "23:00",
    slot_duration_minutes: 120,
    buffer_minutes: 0,
    slots,
  }));
  return renderToStaticMarkup(
    React.createElement(
      ManagerContext.Provider,
      {
        value: {
          data: { schedule: { weekly, rules: [] }, slotRecords: records, tableSlotRecords: [] },
          ready: true,
          storage: {},
          refresh() {},
        },
      },
      React.createElement(
        ToastContext.Provider,
        { value: { showToast() {} } },
        React.createElement(ServicePlanner),
      ),
    ),
  );
}
function removeButton(html, label) {
  const button = html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`));
  assert.ok(button, `${label} must be visible`);
  return button[0];
}

test("booked date slots show their reservation and disable removal, while weekly controls stay editable", () => {
  const html = plannerHtml(windows, [
    { ...windows[0], id: "booked", slot_date: "2030-01-02", reservation_count: 1 },
  ]);
  assert.match(html, /Booked/);
  assert.match(removeButton(html, "Remove Date time slots slot 1"), /disabled/);
  assert.doesNotMatch(removeButton(html, "Remove Date time slots slot 2"), /disabled/);
  assert.doesNotMatch(removeButton(html, "Remove Weekly time slots slot 1"), /disabled/);
  assert.match(html, /<option value="closed" disabled="">/);
});

test("new managers render an empty slot list", () => {
  const html = plannerHtml([]);
  assert.match(html, /No time slots configured/);
  assert.doesNotMatch(html, /aria-label="Remove Weekly time slots/);
});

test("table controls lock the reserved date table without locking the weekly template", () => {
  const props = {
    draft: [{ table_id: "table-1", table_number: 1, capacity: 4, included: true }],
    catalog: [],
    showCatalogCandidates: false,
  };
  const weekly = renderToStaticMarkup(React.createElement(TableBoxes, props));
  const dated = renderToStaticMarkup(
    React.createElement(TableBoxes, {
      ...props,
      getStatus: () => ({ booked: true }),
      allowBlock: true,
    }),
  );
  assert.doesNotMatch(weekly, /disabled/);
  assert.match(dated, /Booked/);
  assert.match(dated, /<button[^>]*disabled=""[^>]*>Remove/);
  assert.match(dated, /<button[^>]*disabled=""[^>]*>Block/);
});
