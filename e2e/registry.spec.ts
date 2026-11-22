import { expect, test } from "@playwright/test";
import { DATASETS } from "../src/lib/datasets/registry.ts";
import type { LngLatBounds } from "../src/lib/datasets/types.ts";

/** Checks on the registry itself, with no browser. */

/** True if the box is the right way round and on the globe. */
function isValidBox([[west, south], [east, north]]: LngLatBounds): boolean {
  return (
    west < east && south < north && west >= -180 && east <= 180 && south >= -90 && north <= 90
  );
}

/** True if `outer` contains `inner`. */
function contains(outer: LngLatBounds, inner: LngLatBounds): boolean {
  return (
    outer[0][0] <= inner[0][0] &&
    outer[0][1] <= inner[0][1] &&
    outer[1][0] >= inner[1][0] &&
    outer[1][1] >= inner[1][1]
  );
}

test.describe("each dataset's map bounds", () => {
  for (const dataset of DATASETS) {
    test(`${dataset.id} opens on a valid box, inside the box it can be moved within`, () => {
      const { bounds, maxBounds } = dataset.map;
      expect(isValidBox(bounds), "bounds").toBe(true);
      expect(isValidBox(maxBounds), "maxBounds").toBe(true);
      expect(contains(maxBounds, bounds), "maxBounds contains bounds").toBe(true);
    });
  }

  test("the England datasets open on England, as the map always did", () => {
    for (const dataset of DATASETS) {
      expect(dataset.map.bounds).toEqual([
        [-6.2, 49.8],
        [2.1, 55.9],
      ]);
      expect(dataset.map.maxBounds).toEqual([
        [-10, 48],
        [5, 59],
      ]);
    }
  });
});
