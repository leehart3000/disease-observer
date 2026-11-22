import { expect, test } from "@playwright/test";
import { DATASETS, DISEASES } from "../src/lib/datasets/registry.ts";
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

test.describe("each dataset's place", () => {
  for (const dataset of DATASETS) {
    test(`${dataset.id} names its whole place and the code schemes of the place and its areas`, () => {
      const { place, map } = dataset;
      expect(place.name, "name").not.toBe("");
      expect(place.slug, "slug").toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(place.code, "code").not.toBe("");
      expect(place.scheme, "place scheme").not.toBe("");
      expect(map.areaScheme, "area scheme").not.toBe("");
    });
  }

  test("the England datasets use the ONS code for England, as the figures were always read", () => {
    for (const dataset of DATASETS) {
      expect(dataset.place).toEqual({
        name: "England",
        slug: "england",
        code: "E92000001",
        scheme: "ons",
      });
      expect(dataset.map.areaScheme).toBe("ons");
    }
  });

  test("each disease's chart says which areas it draws with the whole place", () => {
    for (const disease of DISEASES) {
      expect(disease.chart.areaLevel, disease.slug).toBe("region");
      expect(disease.chart.areaNoun, disease.slug).toBe("regions");
      expect(disease.chart.areasLabel, disease.slug).toBe("UKHSA regions");
      // The headline dataset is one of the registry's.
      expect(DATASETS.map((dataset) => dataset.id), disease.slug).toContain(disease.headline.datasetId);
    }
  });
});

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
