import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createAction } from "../src/app/actions.js";
import { limitGlobalSelector, scopeActorStyles } from "../build/scopeStyles.js";
import { allowedHooks, auditReactSource } from "./react-policy.mjs";

// These parsers are already installed by the existing Vite/React build tools.
const require = createRequire(import.meta.url);
const postcss = require("postcss");
const sourceRoot = new URL("../src/", import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) => {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      return entry.isDirectory() ? sourceFiles(url) : /\.[jt]sx?$/.test(entry.name) ? [url] : [];
    }),
  );
  return groups.flat();
}

test("application uses only the five allowed hooks without custom hooks", async () => {
  const issues = [];
  for (const url of await sourceFiles(sourceRoot)) {
    const filename = fileURLToPath(url);
    issues.push(...auditReactSource(await readFile(url, "utf8"), filename));
  }
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (/react.*router|router.*react/.test(name)) issues.push(`Router dependency: ${name}`);
  }
  assert.deepEqual(issues, []);
});

test("hook policy allows exactly the requested hooks, context providers and DOM refs", () => {
  assert.deepEqual([...allowedHooks].sort(), [
    "useContext",
    "useEffect",
    "useMemo",
    "useRef",
    "useState",
  ]);
  const example = `
    import { createContext, useState, useEffect, useContext, useMemo, useRef } from 'react';
    const Context = createContext(null);
    function Example() {
      const [value] = useState(0);
      const input = useRef(null);
      const context = useContext(Context);
      const total = useMemo(() => value + 1, [value]);
      useEffect(() => {}, []);
      return <input ref={input} value={total} />;
    }
  `;
  assert.deepEqual(auditReactSource(example), []);
});

test("hook policy rejects advanced hooks, aliases and custom or third-party hooks", () => {
  for (const hook of [
    "useCallback",
    "useReducer",
    "useLayoutEffect",
    "useId",
    "useTransition",
    "useSyncExternalStore",
  ]) {
    assert.ok(auditReactSource(`import { ${hook} as advanced } from 'react';`).length);
    assert.ok(auditReactSource(`React.${hook}();`).length);
  }
  assert.ok(auditReactSource("function useBooking() {}").length);
  assert.ok(auditReactSource("const useBooking = () => null;").length);
  assert.ok(auditReactSource("import { useQuery as query } from 'some-library';").length);
});

test("duplicate async submissions are blocked before a render and during a request", async () => {
  const busy = [],
    errors = [];
  const run = createAction(
    (value) => busy.push(value),
    (value) => errors.push(value),
  );
  let finish,
    submissions = 0;
  const first = run(() => {
    submissions += 1;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await run(() => {
    submissions += 1;
  });
  await run(() => {
    submissions += 1;
  });
  assert.equal(submissions, 1);
  assert.deepEqual(busy, [true]);
  finish("saved");
  assert.equal(await first, "saved");
  assert.deepEqual(busy, [true, false]);
  assert.deepEqual(errors, [""]);
  await run(() => {
    submissions += 1;
  });
  assert.equal(submissions, 2);
});

test("failed submissions expose the error and allow retry", async () => {
  const busy = [],
    errors = [];
  const run = createAction(
    (value) => busy.push(value),
    (value) => errors.push(value),
  );
  assert.equal(
    await run(() => {
      throw new Error("Payment failed");
    }),
    undefined,
  );
  assert.deepEqual(errors, ["", "Payment failed"]);
  assert.deepEqual(busy, [true, false]);
  assert.equal(await run(async () => "retried"), "retried");
  assert.deepEqual(errors, ["", "Payment failed", ""]);
});

test("independent forms can submit concurrently", async () => {
  let finish;
  const first = createAction(
    () => {},
    () => {},
  );
  const second = createAction(
    () => {},
    () => {},
  );
  const pending = first(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  assert.equal(await second(async () => "second form saved"), "second form saved");
  finish();
  await pending;
});

test("global CSS boundaries preserve pseudo-elements and selector arguments", () => {
  const limit = ":where(:not(.diner-app, .diner-app *, .staff-app, .staff-app *))";
  assert.equal(limitGlobalSelector(".card::before"), `.card${limit}::before`);
  assert.equal(
    limitGlobalSelector('input[data-label="::before"]::placeholder'),
    `input[data-label="::before"]${limit}::placeholder`,
  );
  assert.equal(limitGlobalSelector(":is(.card, .item)::after"), `:is(.card, .item)${limit}::after`);
});

test("staff CSS stays isolated without renaming modal-body classes or keyframe steps", async () => {
  const result = await postcss([scopeActorStyles()]).process(
    ":root { --color: red; } body { color: red; } .modal-body { padding: 1px; animation: fadeIn 1s; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }",
    { from: "/project/src/apps/restaurant-staff/styles/login.css?inline" },
  );
  assert.match(result.css, /\.staff-surface \{ --color/);
  assert.match(result.css, /:where\(\.staff-surface\) \.modal-body/);
  assert.match(result.css, /animation: staff-fadeIn 1s/);
  assert.match(result.css, /@keyframes staff-fadeIn \{ from/);
  assert.doesNotMatch(result.css, /modal-\.staff-surface/);
});
