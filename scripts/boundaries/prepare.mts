/**
 * Turns the raw ONS boundary downloads into the small, England-only files
 * that are committed to Git.
 *
 * Reads `data/ons/raw/` (not in Git) and writes `data/ons/*.geojson`. Each
 * output feature keeps only a `code`, a `name` and its geometry. The ONS
 * files are already in WGS 84 (EPSG:4326), so no reprojection is needed;
 * the script stops if a file says otherwise.
 *
 * Run with `pnpm boundaries:prepare`.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};

type FeatureCollection = {
  type: "FeatureCollection";
  crs?: { properties?: { name?: string } };
  features: Feature[];
};

type Job = {
  input: string;
  output: string;
  codeProperty: string;
  nameProperty: string;
  /** Which features to keep, by code. */
  keep: (code: string) => boolean;
  expected: number;
};

const jobs: Job[] = [
  {
    input: "data/ons/raw/LAD_DEC_2022_UK_BUC.geojson",
    output: "data/ons/lad-dec-2022-england.geojson",
    codeProperty: "LAD22CD",
    nameProperty: "LAD22NM",
    keep: (code) => /^E0[6789]/.test(code),
    expected: 309,
  },
  {
    input: "data/ons/raw/RGN_DEC_2022_EN_BUC.geojson",
    output: "data/ons/rgn-dec-2022-england.geojson",
    codeProperty: "RGN22CD",
    nameProperty: "RGN22NM",
    keep: () => true,
    expected: 9,
  },
];

/** Reads a string property, or fails with a clear message. */
function readText(feature: Feature, property: string, file: string): string {
  const value = feature.properties[property];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${file}: a feature has no "${property}" property`);
  }
  return value;
}

for (const job of jobs) {
  const collection = JSON.parse(readFileSync(job.input, "utf8")) as FeatureCollection;

  const crs = collection.crs?.properties?.name;
  if (crs !== "EPSG:4326") {
    throw new Error(`${job.input}: expected EPSG:4326 but found ${crs ?? "no CRS"}`);
  }

  const features = collection.features
    .map((feature) => ({
      type: "Feature" as const,
      properties: {
        code: readText(feature, job.codeProperty, job.input),
        name: readText(feature, job.nameProperty, job.input),
      },
      geometry: feature.geometry,
    }))
    .filter((feature) => job.keep(feature.properties.code))
    .sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  if (features.length !== job.expected) {
    throw new Error(
      `${job.input}: expected ${job.expected} features but kept ${features.length}`,
    );
  }

  mkdirSync(dirname(job.output), { recursive: true });
  // Compact JSON (no spaces), one trailing newline. GeoJSON in WGS 84 is the
  // default CRS, so no `crs` member is written.
  writeFileSync(
    job.output,
    `${JSON.stringify({ type: "FeatureCollection", features })}\n`,
  );
  const kilobytes = (statSync(job.output).size / 1024).toFixed(0);
  console.log(`${job.output}: ${features.length} features, ${kilobytes} KiB`);
}
