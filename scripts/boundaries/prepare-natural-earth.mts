/**
 * Turns the raw Natural Earth downloads into the small files that are
 * committed to Git (see `data/natural-earth/README.md`).
 *
 * Reads `data/natural-earth/raw/` (not in Git) and writes:
 *
 * - `data/natural-earth/countries-50m.geojson`: every country, dependency and
 *   disputed area, each with a `code` (ISO 3166-1 alpha-3, see
 *   `country-codes.mts`), a `name` and a `slug`.
 * - `data/natural-earth/countries.json`: the same, without the shapes, for
 *   code that only needs the list (the places on the site).
 * - `data/natural-earth/us-states-50m.geojson`: the 50 US states and the
 *   District of Columbia, each with a `code` (ISO 3166-2, `US-AL`) and a `name`.
 *
 * Coordinates are rounded to 3 decimal places (about 100 metres, finer than
 * the 1:50 million source) and repeated points are dropped. The source files
 * are in WGS 84 longitude and latitude; the script stops if they are not.
 *
 * Run with `pnpm boundaries:prepare:natural-earth`.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import {
  chooseCountryCodes,
  countryName,
  RESERVED_SLUGS,
  slugify,
  usStateCode,
} from "./country-codes.mts";

type Position = number[];
type Polygon = Position[][];

type Feature = {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Polygon | Polygon[] };
};

type Collection = {
  crs?: { properties?: { name?: string } };
  features: Feature[];
};

const RAW_DIR = "data/natural-earth/raw";
const OUTPUT_DIR = "data/natural-earth";
const DECIMAL_PLACES = 3;

/** How many features the pinned release (v5.1.2) has. A different number means a different file. */
const EXPECTED_COUNTRIES = 242;
const EXPECTED_US_STATES = 51;

/** Reads a GeoJSON file and checks that it is in longitude and latitude. */
function readCollection(file: string): Collection {
  const collection = JSON.parse(readFileSync(`${RAW_DIR}/${file}`, "utf8")) as Collection;
  const crs = collection.crs?.properties?.name;
  if (crs !== undefined && crs !== "urn:ogc:def:crs:OGC:1.3:CRS84") {
    throw new Error(`${file}: expected longitude and latitude (CRS84) but found ${crs}`);
  }
  return collection;
}

/** Reads a string property, or fails with a clear message. */
function text(feature: Feature, property: string, file: string): string {
  const value = feature.properties[property];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${file}: a feature has no "${property}" property`);
  }
  return value;
}

/** Rounds a ring's points and removes points that repeat the one before. */
function roundRing(ring: Position[]): Position[] {
  const scale = 10 ** DECIMAL_PLACES;
  const result: Position[] = [];
  for (const [x, y] of ring) {
    const point = [Math.round(x * scale) / scale, Math.round(y * scale) / scale];
    const last = result[result.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) result.push(point);
  }
  return result;
}

/**
 * Rounds a geometry. A ring that has fewer than 4 points after rounding is no
 * longer a ring, so it is dropped (a hole), and so is a polygon whose outer
 * ring is dropped (a speck smaller than the rounding).
 */
function roundGeometry(geometry: Feature["geometry"], label: string): Feature["geometry"] {
  const polygons: Polygon[] =
    geometry.type === "Polygon" ? [geometry.coordinates as Polygon] : (geometry.coordinates as Polygon[]);
  const kept: Polygon[] = [];
  for (const polygon of polygons) {
    const [outer, ...holes] = polygon.map(roundRing);
    if (!outer || outer.length < 4) continue;
    kept.push([outer, ...holes.filter((hole) => hole.length >= 4)]);
  }
  if (kept.length === 0) throw new Error(`${label}: no polygon is left after rounding`);
  return kept.length === 1 ? { type: "Polygon", coordinates: kept[0] } : { type: "MultiPolygon", coordinates: kept };
}

/** Writes compact JSON with one trailing newline, and reports the size. */
function write(path: string, value: unknown, label: string) {
  writeFileSync(path, `${JSON.stringify(value)}\n`);
  console.log(`${path}: ${label}, ${(statSync(path).size / 1024).toFixed(0)} KiB`);
}

/** Fails if any value in the list appears twice. */
function assertUnique(values: string[], what: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Two features have the same ${what}: ${value}`);
    seen.add(value);
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });

// Countries.
const countriesFile = "ne_50m_admin_0_countries.geojson";
const countries = readCollection(countriesFile);
if (countries.features.length !== EXPECTED_COUNTRIES) {
  throw new Error(
    `${countriesFile}: expected ${EXPECTED_COUNTRIES} features but found ${countries.features.length}`,
  );
}
const chosen = chooseCountryCodes(
  countries.features.map((feature) => ({
    isoA3Eh: text(feature, "ISO_A3_EH", countriesFile),
    adm0A3: text(feature, "ADM0_A3", countriesFile),
  })),
);
const countryFeatures = countries.features
  .map((feature, index) => {
    const name = countryName(text(feature, "ADMIN", countriesFile));
    return {
      type: "Feature" as const,
      properties: { code: chosen[index].code, name, slug: slugify(name) },
      geometry: roundGeometry(feature.geometry, name),
    };
  })
  .sort((a, b) => a.properties.code.localeCompare(b.properties.code));

assertUnique(countryFeatures.map((f) => f.properties.code), "code");
assertUnique(countryFeatures.map((f) => f.properties.slug), "slug");
for (const { properties } of countryFeatures) {
  if (!/^[A-Z]{3}$/.test(properties.code)) throw new Error(`Not a three-letter code: ${properties.code}`);
  if (RESERVED_SLUGS.includes(properties.slug)) {
    throw new Error(`${properties.name} has the slug "${properties.slug}", which is reserved`);
  }
}

write(
  `${OUTPUT_DIR}/countries-50m.geojson`,
  { type: "FeatureCollection", features: countryFeatures },
  `${countryFeatures.length} countries`,
);
write(
  `${OUTPUT_DIR}/countries.json`,
  countryFeatures
    .map(({ properties }) => properties)
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB")),
  "index",
);

// US states (and the District of Columbia).
const statesFile = "ne_50m_admin_1_states_provinces.geojson";
const states = readCollection(statesFile);
const stateFeatures = states.features
  .filter((feature) => feature.properties.adm0_a3 === "USA")
  .map((feature) => {
    const name = text(feature, "name", statesFile);
    return {
      type: "Feature" as const,
      properties: { code: usStateCode(feature.properties.iso_3166_2), name },
      geometry: roundGeometry(feature.geometry, name),
    };
  })
  .sort((a, b) => a.properties.code.localeCompare(b.properties.code));
if (stateFeatures.length !== EXPECTED_US_STATES) {
  throw new Error(`${statesFile}: expected ${EXPECTED_US_STATES} US states but found ${stateFeatures.length}`);
}
assertUnique(stateFeatures.map((f) => f.properties.code), "state code");
write(
  `${OUTPUT_DIR}/us-states-50m.geojson`,
  { type: "FeatureCollection", features: stateFeatures },
  `${stateFeatures.length} US states`,
);

// What was not a plain ISO code, so it can be checked by eye.
const notIso = chosen
  .map((entry, index) => ({ ...entry, name: String(countries.features[index].properties.ADMIN) }))
  .filter((entry) => entry.source !== "iso");
console.log("\nCountries whose code is not Natural Earth's ISO code:");
for (const entry of notIso) console.log(`  ${entry.code}  ${entry.name}  (${entry.source})`);
