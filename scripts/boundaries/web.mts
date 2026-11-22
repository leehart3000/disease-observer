/**
 * Builds the boundary files that the map page loads in the browser, from
 * the committed ONS files in `data/ons/` and Natural Earth files in
 * `data/natural-earth/`. The output goes to
 * `public/boundaries/` (ignored by Git) and is rebuilt by `pnpm dev` and
 * `pnpm build`, so it always matches the committed sources.
 *
 * What changes compared with the committed files:
 *
 * - Codes and names follow UKHSA (see `ukhsa-codes.mts`): regions use the
 *   E45 codes, and the two combined local authorities are one feature each
 *   (their polygons are joined into one multi-polygon, without a union).
 * - Coordinates are rounded to 5 decimal places (about 1 metre) and
 *   repeated points are dropped.
 * - Every feature is a MultiPolygon with just a `code` and a `name`.
 *
 * Run with `pnpm boundaries:web`.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { COMBINED_AREAS, MERGED_AWAY, REGIONS } from "./ukhsa-codes.mts";

type Position = number[];
type Polygon = Position[][];

type SourceFeature = {
  properties: { code: string; name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Polygon | Polygon[] };
};

type OutputFeature = {
  type: "Feature";
  properties: { code: string; name: string };
  geometry: { type: "MultiPolygon"; coordinates: Polygon[] };
};

const OUTPUT_DIR = "public/boundaries";
const DECIMAL_PLACES = 5;

/** Reads a committed GeoJSON file into a map from ONS code to feature. */
function readFeatures(path: string): Map<string, SourceFeature> {
  const collection = JSON.parse(readFileSync(path, "utf8")) as {
    features: SourceFeature[];
  };
  return new Map(
    collection.features.map((feature) => [feature.properties.code, feature]),
  );
}

/** Returns the polygons of a feature, whether it is a Polygon or a MultiPolygon. */
function polygonsOf(feature: SourceFeature): Polygon[] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Polygon]
    : (feature.geometry.coordinates as Polygon[]);
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

/** Builds an output feature from one or more source features. */
function makeFeature(
  code: string,
  name: string,
  sources: SourceFeature[],
): OutputFeature {
  return {
    type: "Feature",
    properties: { code, name },
    geometry: {
      type: "MultiPolygon",
      coordinates: sources.flatMap(polygonsOf).map((polygon) => polygon.map(roundRing)),
    },
  };
}

/** Returns the features with the given codes, or fails if one is missing. */
function pick(
  features: Map<string, SourceFeature>,
  codes: string[],
  file: string,
): SourceFeature[] {
  return codes.map((code) => {
    const feature = features.get(code);
    if (!feature) throw new Error(`${file} has no feature for ${code}`);
    return feature;
  });
}

/** Writes a FeatureCollection as compact JSON and reports its size. */
function write(name: string, features: OutputFeature[]) {
  const path = `${OUTPUT_DIR}/${name}`;
  writeFileSync(path, JSON.stringify({ type: "FeatureCollection", features }));
  console.log(
    `${path}: ${features.length} features, ${(statSync(path).size / 1024).toFixed(0)} KiB`,
  );
}

const lads = readFeatures("data/ons/lad-dec-2022-england.geojson");
const regions = readFeatures("data/ons/rgn-dec-2022-england.geojson");

const ladFeatures: OutputFeature[] = [];
for (const [onsCode, feature] of lads) {
  if (MERGED_AWAY.has(onsCode)) continue;
  const combined = COMBINED_AREAS[onsCode];
  ladFeatures.push(
    combined
      ? makeFeature(
          onsCode,
          combined.name,
          pick(lads, combined.onsCodes, "the LAD file"),
        )
      : makeFeature(onsCode, feature.properties.name, [feature]),
  );
}

for (const code of regions.keys()) {
  if (!(code in REGIONS)) throw new Error(`No UKHSA code is mapped for region ${code}`);
}
const regionFeatures = Object.entries(REGIONS).map(([e12Code, region]) =>
  makeFeature(region.code, region.name, pick(regions, [e12Code], "the region file")),
);

const expectedLads = lads.size - MERGED_AWAY.size;
if (ladFeatures.length !== expectedLads) {
  throw new Error(`Expected ${expectedLads} local authorities, got ${ladFeatures.length}`);
}
if (regionFeatures.length !== 9) {
  throw new Error(`Expected 9 regions, got ${regionFeatures.length}`);
}

// Natural Earth: every country, and the US states. Their committed files
// already have the codes and names this site uses, and rounded coordinates,
// so they only need the same shape as the others (every feature a
// MultiPolygon with just a code and a name).
const countryFeatures = [...readFeatures("data/natural-earth/countries-50m.geojson").values()].map(
  (feature) => makeFeature(feature.properties.code, feature.properties.name, [feature]),
);
const usStateFeatures = [...readFeatures("data/natural-earth/us-states-50m.geojson").values()].map(
  (feature) => makeFeature(feature.properties.code, feature.properties.name, [feature]),
);
if (countryFeatures.length !== 242) {
  throw new Error(`Expected 242 countries, got ${countryFeatures.length}`);
}
if (usStateFeatures.length !== 51) {
  throw new Error(`Expected 51 US states, got ${usStateFeatures.length}`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
write("lad-dec-2022.json", ladFeatures);
write("rgn-dec-2022.json", regionFeatures);
write("countries-50m.json", countryFeatures);
write("us-states-50m.json", usStateFeatures);
