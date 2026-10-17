import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { tableStatusLabel } from "../src/apps/restaurant-staff/utils/format.js";
const require = createRequire(import.meta.url);
async function render(file, data, mocks, overrides = {}, exercise) {
  const source = await readFile(new URL(`../src/apps/${file}`, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" });
  let stateIndex = 0;
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require(id) {
      if (id === "react")
        return {
          ...React,
          useContext: () => data,
          useEffect() {},
          useState(initial) {
            const index = stateIndex++;
            return [
              Object.hasOwn(overrides, index)
                ? overrides[index]
                : typeof initial === "function"
                  ? initial()
                  : initial,
              () => {},
            ];
          },
        };
      return Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    },
  });
  if (exercise) {
    await exercise(module.exports.default());
    stateIndex = 0;
  }
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
function findControl(tree, label) {
  if (!tree || typeof tree !== "object") return null;
  if (tree.type === "button" && tree.props.children === label) return tree;
  for (const child of React.Children.toArray(tree.props?.children)) {
    const found = findControl(child, label);
    if (found) return found;
  }
  return null;
}
const children = ({ children }) => children;
const staffMocks = {
  "../context/StaffContext.js": { StaffContext: {} },
  "../components/StaffUI.jsx": {
    TopNav: () => null,
    Icon: () => null,
    ErrorMsg: ({ message }) => message || null,
    Modal: children,
  },
  "../utils/format.js": { toIsoDate: () => "2030-01-01", tableStatusLabel },
};
const staffData = { tables: [], slots: [], api: {}, navigate() {}, loading: false };
test("staff only toggles available and blocked tables for the selected service", async () => {
  for (const status of ["Available", "Blocked"]) {
    const writes = [];
    const html = await render(
      "restaurant-staff/pages/DashboardPage.jsx",
      {
        ...staffData,
        api: { updateTableStatus: async (...args) => writes.push(args), refresh: async () => {} },
      },
      staffMocks,
      {
        3: { id: "t1", computedStatus: "available", slotIds: ["s1"] },
        4: status,
      },
      async (tree) => {
        const button = findControl(tree, "Update Status");
        if (status !== "Available") {
          assert.equal(button.props.disabled, false);
          await button.props.onClick();
          assert.deepEqual(writes, [["t1", ["s1"], status]]);
        } else assert.equal(button.props.disabled, true);
      },
    );
    for (const option of ["Available", "Blocked"]) {
      assert.match(html, new RegExp(`option value="${option}"`));
    }
    assert.doesNotMatch(html, /option value="Reserved"/);
    assert.doesNotMatch(html, /option value="Occupied"/);
  }
  for (const status of ["reserved", "occupied"]) {
    const manual = await render("restaurant-staff/pages/DashboardPage.jsx", staffData, staffMocks, {
      3: { id: "t1", computedStatus: status, bookingManaged: false },
    });
    assert.doesNotMatch(manual, /Select New Status/);
    assert.equal((manual.match(/Customer Check-In/g) || []).length, 1);
    const booked = await render("restaurant-staff/pages/DashboardPage.jsx", staffData, staffMocks, {
      3: { id: "t1", computedStatus: status, bookingManaged: true },
    });
    assert.doesNotMatch(booked, /Select New Status/);
    assert.equal((booked.match(/Customer Check-In/g) || []).length, 1);
  }
  const scheduled = await render(
    "restaurant-staff/pages/DashboardPage.jsx",
    staffData,
    staffMocks,
    { 3: { id: "t1", computedStatus: "blocked", scheduleBlocked: true } },
  );
  assert.match(scheduled, /blocked by the manager schedule/);
  assert.doesNotMatch(scheduled, /Select New Status/);
});
test("manager shows distinct booking pause and restaurant closure controls", async () => {
  const data = {
    data: {
      profile: {},
      restaurant: {
        verificationStatus: "approved",
        tableCount: 2,
        timeSlotCount: 2,
        is_open: false,
      },
      reservations: [{ reservation_status: "reserved" }],
    },
  };
  const html = await render("manager/pages/ProfilePage.jsx", data, {
    "../components/ManagerLayout": children,
    "../context/ManagerContext.jsx": { ManagerContext: {} },
    "../context/ToastContext.jsx": { ToastContext: {} },
  });
  assert.match(html, /Accept new reservations/);
  assert.match(html, /New reservations paused/);
  assert.match(html, /1 active reservation/);
  assert.match(html, /Close restaurant/);
  assert.match(html, /View active reservations/);
});

test("closure follow-up shows active manager bookings on future dates too", async () => {
  const html = await render(
    "manager/pages/ReservationsPage.jsx",
    {
      params: { active: "true" },
      data: {
        reservations: [
          {
            id: "future",
            name: "Future Diner",
            date: "2035-01-01",
            status: "Pending",
            reservation_status: "reserved",
          },
          {
            id: "done",
            name: "Finished Diner",
            date: "2035-01-01",
            status: "Complete",
            reservation_status: "completed",
          },
        ],
      },
    },
    {
      "../../../app/indiaTime.js": { indiaToday: () => "2030-01-01" },
      "../../../app/actions.js": { createAction: () => () => {} },
      "../components/ManagerLayout": children,
      "../context/ManagerContext.jsx": { ManagerContext: {} },
      "../context/ToastContext.jsx": { ToastContext: {} },
    },
  );
  assert.match(html, /Future Diner/);
  assert.doesNotMatch(html, /Finished Diner/);
});

test("manager closure and pause handlers report success through the toast provider", async () => {
  const closed = [],
    notices = [];
  await render(
    "manager/pages/ProfilePage.jsx",
    {
      data: { restaurant: { is_open: true }, reservations: [] },
      storage: {
        setClosureStatus: async (value) => closed.push(value),
        setServingStatus: async () => ({ active_reservation_count: 0 }),
      },
      refresh() {},
      showToast: (message) => notices.push(message),
    },
    {
      "../components/ManagerLayout": children,
      "../context/ManagerContext.jsx": { ManagerContext: {} },
      "../context/ToastContext.jsx": { ToastContext: {} },
    },
    {},
    async (tree) => {
      await findControl(tree, "Close restaurant").props.onClick();
      function checkbox(node) {
        if (!node || typeof node !== "object") return null;
        if (node.type === "input" && node.props["aria-label"] === "Accept new reservations")
          return node;
        return React.Children.toArray(node.props?.children).map(checkbox).find(Boolean);
      }
      await checkbox(tree).props.onChange({ target: { checked: false } });
    },
  );
  assert.deepEqual(closed, [true]);
  assert.deepEqual(notices, [
    "Restaurant closed.",
    "New reservations paused. 0 existing reservation(s) remain confirmed.",
  ]);
});
