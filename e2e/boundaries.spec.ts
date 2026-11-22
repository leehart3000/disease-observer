import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  chooseCountryCodes,
  countryName,
  RESERVED_SLUGS,
  slugify,
  usStateCode,
} from "../scripts/boundaries/country-codes.mts";

/**
 * Checks on the Natural Earth country and US state boundaries: the rules that
 * make codes, names and slugs, and the committed files they produced. No
 * browser. (The database loader checks its own counts when it runs.)
 */

type Feature = {
  properties: { code: string; name: string; slug?: string };
  geometry: { type: string; coordinates: unknown };
};

const readJson = <T,>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const countries = readJson<Array<{ code: string; name: string; slug: string }>>(
  "data/natural-earth/countries.json",
);
const countryShapes = readJson<{ features: Feature[] }>("data/natural-earth/countries-50m.geojson");
const stateShapes = readJson<{ features: Feature[] }>("data/natural-earth/us-states-50m.geojson");

test.describe("slugs", () => {
  test("are lowercase words joined by hyphens, with accents and apostrophes handled", () => {
    expect(slugify("France")).toBe("france");
    expect(slugify("Côte d'Ivoire")).toBe("cote-d-ivoire");
    expect(slugify("São Tomé and Príncipe")).toBe("sao-tome-and-principe");
    expect(slugify("Åland Islands")).toBe("aland-islands");
    expect(slugify("Guinea-Bissau")).toBe("guinea-bissau");
    expect(slugify("Trinidad & Tobago")).toBe("trinidad-and-tobago");
    expect(slugify("  St. Kitts   and Nevis ")).toBe("st-kitts-and-nevis");
  });

  test("names use the overrides where Natural Earth's are formal or odd", () => {
    expect(countryName("United States of America")).toBe("United States");
    expect(countryName("Ivory Coast")).toBe("Côte d'Ivoire");
    expect(countryName("France")).toBe("France");
  });
});

test.describe("country codes", () => {
  test("use the ISO code, or Natural Earth's own where there is none or it is shared", () => {
    const result = chooseCountryCodes([
      { isoA3Eh: "FRA", adm0A3: "FRA" }, // France: ISO_A3 is -99 but ISO_A3_EH has it
      { isoA3Eh: "AUS", adm0A3: "AUS" }, // Australia
      { isoA3Eh: "AUS", adm0A3: "IOA" }, // Indian Ocean Territories share Australia's code
      { isoA3Eh: "-99", adm0A3: "SOL" }, // Somaliland: no ISO code
      { isoA3Eh: "-99", adm0A3: "KOS" }, // Kosovo: no ISO code, the user-assigned XKX is used
    ]);
    expect(result).toEqual([
      { code: "FRA", source: "iso" },
      { code: "AUS", source: "iso" },
      { code: "IOA", source: "natural-earth" },
      { code: "SOL", source: "natural-earth" },
      { code: "XKX", source: "override" },
    ]);
  });

  test("a US state code is ISO 3166-2", () => {
    expect(usStateCode("US-AL")).toBe("US-AL");
    expect(() => usStateCode("AL")).toThrow();
    expect(() => usStateCode(undefined)).toThrow();
  });
});

test.describe("the committed country files", () => {
  test("hold 242 countries with unique three-letter codes and unique, well-formed slugs", () => {
    expect(countries).toHaveLength(242);
    expect(new Set(countries.map((c) => c.code)).size).toBe(242);
    expect(new Set(countries.map((c) => c.slug)).size).toBe(242);
    for (const { code, slug } of countries) {
      expect(code, slug).toMatch(/^[A-Z]{3}$/);
      expect(code).not.toBe("-99");
      expect(slug, code).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(RESERVED_SLUGS, `${code} takes a reserved slug`).not.toContain(slug);
    }
  });

  test("have the awkward cases right", () => {
    const by = new Map(countries.map((c) => [c.code, c]));
    expect(by.get("USA")).toEqual({ code: "USA", name: "United States", slug: "united-states" });
    expect(by.get("CIV")).toEqual({ code: "CIV", name: "Côte d'Ivoire", slug: "cote-d-ivoire" });
    expect(by.get("XKX")?.name).toBe("Kosovo");
    // France and Norway have no `ISO_A3` in Natural Earth, but do here.
    expect(by.get("FRA")?.slug).toBe("france");
    expect(by.get("NOR")?.slug).toBe("norway");
    // The small states that the 1:110m file leaves out.
    for (const code of ["MLT", "LIE", "LUX", "MCO", "SMR", "AND"]) expect(by.has(code), code).toBe(true);
    // The United Kingdom is a different place from England.
    expect(by.get("GBR")?.slug).toBe("united-kingdom");
    // Territories are their own areas.
    expect(by.get("PRI")?.name).toBe("Puerto Rico");
  });

  test("the shapes match the index, and every shape is a polygon on the globe", () => {
    expect(countryShapes.features.map((f) => f.properties.code).sort()).toEqual(
      countries.map((c) => c.code).sort(),
    );
    for (const feature of [...countryShapes.features, ...stateShapes.features]) {
      expect(["Polygon", "MultiPolygon"], feature.properties.code).toContain(feature.geometry.type);
      // A plain loop and one check for the feature: a check for every point is far too slow.
      const numbers = JSON.stringify(feature.geometry.coordinates).match(/-?\d+(\.\d+)?/g)!.map(Number);
      let onGlobe = numbers.length > 7;
      for (let i = 0; i < numbers.length; i += 2) {
        if (Math.abs(numbers[i]) > 180 || Math.abs(numbers[i + 1]) > 90) onGlobe = false;
      }
      expect(onGlobe, feature.properties.code).toBe(true);
    }
  });

  test("hold the 50 US states and the District of Columbia", () => {
    const codes = stateShapes.features.map((f) => f.properties.code);
    expect(codes).toHaveLength(51);
    expect(new Set(codes).size).toBe(51);
    for (const code of codes) expect(code).toMatch(/^US-[A-Z]{2}$/);
    const names = new Map(stateShapes.features.map((f) => [f.properties.code, f.properties.name]));
    expect(names.get("US-AL")).toBe("Alabama");
    expect(names.get("US-DC")).toBe("District of Columbia");
    expect(names.get("US-AK")).toBe("Alaska");
    // The territories are countries in the other file, not states here.
    expect(codes).not.toContain("US-PR");
  });
});
