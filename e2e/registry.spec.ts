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
    const england = DATASETS.filter((dataset) => dataset.sourceSlugs[0] === "ukhsa");
    expect(england.map((dataset) => dataset.id)).toEqual(["covid-19-rate", "measles-cases"]);
    for (const dataset of england) {
      expect(dataset.place).toEqual({
        name: "England",
        slug: "england",
        code: "E92000001",
        scheme: "ons",
      });
      expect(dataset.map.areaScheme).toBe("ons");
    }
  });

  test("the hospital admission datasets are for the United States, with states in their own scheme", () => {
    const us = DATASETS.filter((dataset) => dataset.sourceSlugs[0] === "cdc-nhsn");
    expect(us.map((dataset) => dataset.id)).toEqual([
      "influenza-hospital-admissions",
      "rsv-hospital-admissions",
      "covid-19-hospital-admissions-us",
    ]);
    for (const dataset of us) {
      // The national row is an ISO 3166-1 country; the states are ISO 3166-2.
      expect(dataset.place.code, dataset.id).toBe("USA");
      expect(dataset.place.scheme, dataset.id).toBe("iso3166-1-alpha3");
      expect(dataset.place.slug, dataset.id).toBe("united-states");
      expect(dataset.map.areaScheme, dataset.id).toBe("iso3166-2");
      expect(dataset.map.areaLevel, dataset.id).toBe("region");
      expect((dataset.map as { boundaryNotice?: string }).boundaryNotice, dataset.id).toBe("natural-earth");
      expect(dataset.sourceSlugs, dataset.id).toEqual(["cdc-nhsn", "natural-earth"]);
      // CDC's name is only in the credit, never in what the site calls the data.
      expect(`${dataset.label} ${dataset.name} ${dataset.title} ${dataset.description}`, dataset.id).not.toMatch(/CDC/);
    }
  });

  test("each disease's chart says which areas it draws with the whole place, if any", () => {
    for (const disease of DISEASES) {
      if (["covid-19", "measles"].includes(disease.slug)) {
        expect(disease.chart.areas, disease.slug).toEqual({
          level: "region",
          noun: "regions",
          label: "UKHSA regions",
        });
      } else {
        // Too many states for a chart of them all: the whole country on its own.
        expect(disease.chart.areas, disease.slug).toBeNull();
      }
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
    for (const dataset of DATASETS.filter((d) => d.place.slug === "england")) {
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

  test("the US datasets open on the contiguous United States, and can reach Alaska and Hawaii", () => {
    for (const dataset of DATASETS.filter((d) => d.place.slug === "united-states")) {
      const [[west, south], [east, north]] = dataset.map.bounds;
      expect(west).toBeLessThan(-120);
      expect(east).toBeGreaterThan(-70);
      expect(south).toBeLessThan(26);
      expect(north).toBeGreaterThan(48);
      const [[maxWest, maxSouth], [, maxNorth]] = dataset.map.maxBounds;
      // Hawaii is at about 19 degrees north and 155 west, Alaska reaches 71 north and 170 west.
      expect(maxWest).toBeLessThan(-170);
      expect(maxSouth).toBeLessThan(18);
      expect(maxNorth).toBeGreaterThan(71);
    }
  });
});

test.describe("text that belongs to one dataset", () => {
  test("each dataset explains its map, and no disease description does", () => {
    for (const dataset of DATASETS) {
      expect(dataset.mapExplanation, dataset.id).toMatch(/^The map shows /);
    }
    for (const disease of DISEASES) {
      for (const paragraph of disease.about) {
        expect(paragraph, disease.slug).not.toContain("The map shows");
      }
    }
  });
});
