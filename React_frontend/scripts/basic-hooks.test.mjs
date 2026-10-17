import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

const require = createRequire(import.meta.url);

async function loadComponent(file, dependencies = {}, globals = {}) {
  const effects = [];
  const refs = [];
  const source = await readFile(
    new URL(`../src/apps/diner/components/${file}`, import.meta.url),
    "utf8",
  );
  const module = { exports: {} };
  const { code } = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" });
  runInNewContext(code, {
    module,
    exports: module.exports,
    ...globals,
    require(id) {
      if (id === "react")
        return {
          useEffect: (effect) => effects.push(effect),
          useRef: (value) => {
            const ref = { current: value };
            refs.push(ref);
            return ref;
          },
        };
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      if (id.endsWith(".css")) return {};
      return require(id);
    },
  });
  return { components: module.exports, effects, refs };
}

test("native dialogs use a direct DOM ref and close when unmounted", async () => {
  const { components, effects } = await loadComponent("Feedback.jsx", {
    "../context/DinerContext.js": {},
  });
  const dialog = components.Modal({ title: "Details", onClose() {}, children: "Reservation" });
  let opened = 0,
    closed = 0;
  dialog.props.ref.current = {
    showModal() {
      opened++;
    },
    close() {
      closed++;
    },
  };
  const cleanup = effects[0]();
  assert.equal(opened, 1);
  cleanup();
  assert.equal(closed, 1);
});

test("map refs preserve coordinate updates and remove listeners and the map on unmount", async () => {
  const mapEvents = new Map(),
    markerEvents = new Map();
  let removed = 0,
    disconnected = 0,
    observed;
  const positions = [],
    changes = [];
  const map = {
    setView() {
      return this;
    },
    panTo(value) {
      positions.push(value);
    },
    invalidateSize() {},
    on(name, callback) {
      mapEvents.set(name, callback);
    },
    off(name) {
      mapEvents.delete(name);
    },
    remove() {
      removed++;
    },
  };
  const marker = {
    addTo() {
      return this;
    },
    setLatLng(value) {
      positions.push(value);
    },
    getLatLng() {
      return { lat: 13, lng: 77 };
    },
    on(name, callback) {
      markerEvents.set(name, callback);
    },
    off(name) {
      markerEvents.delete(name);
    },
  };
  const leaflet = {
    map: () => map,
    tileLayer: () => ({ addTo() {} }),
    icon: () => ({}),
    marker: () => marker,
  };
  const { components, effects, refs } = await loadComponent(
    "LocationMap.jsx",
    {
      leaflet,
      "../utils/images.js": { image: (name) => name },
    },
    {
      ResizeObserver: class {
        observe(container) {
          observed = container;
        }
        disconnect() {
          disconnected++;
        }
      },
    },
  );
  const element = components.default({
    latitude: 12,
    longitude: 77,
    onChange: (value) => changes.push(value),
  });
  const container = {};
  element.props.ref.current = container;
  const cleanups = effects.map((effect) => effect());
  assert.equal(observed, container);
  assert.equal(positions.length, 2);
  mapEvents.get("click")({ latlng: { lat: 14, lng: 78 } });
  markerEvents.get("dragend")();
  assert.equal(changes[0].latitude, 14);
  assert.equal(changes[1].latitude, 13);
  cleanups.forEach((cleanup) => cleanup?.());
  assert.equal(removed, 1);
  assert.equal(disconnected, 1);
  assert.equal(mapEvents.size, 0);
  assert.equal(markerEvents.size, 0);
  assert.equal(refs[1].current, null);
  assert.equal(refs[2].current, null);
});
