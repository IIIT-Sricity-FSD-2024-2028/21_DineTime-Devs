import test from "node:test";
import assert from "node:assert/strict";
import { hasMapCoordinates, mapCoordinates } from "../src/apps/diner/utils/mapCoordinates.js";

test("clearing city coordinates cannot pass null or invalid coordinates to Leaflet", () => {
  for (const pair of [
    [null, null],
    [undefined, undefined],
    ["", ""],
    [NaN, 77.5],
    [91, 181],
    ["bad", 77.5],
  ]) {
    assert.equal(hasMapCoordinates(...pair), false);
    assert.deepEqual(mapCoordinates(...pair), [12.9716, 77.5946]);
  }
  assert.equal(hasMapCoordinates(0, 0), true);
  assert.deepEqual(mapCoordinates("13.0827", "80.2707"), [13.0827, 80.2707]);
});
