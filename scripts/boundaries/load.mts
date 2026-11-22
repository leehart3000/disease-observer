/**
 * Loads the committed ONS boundaries (`data/ons/*.geojson`) into the
 * `areas` table. Safe to run more than once: areas are matched by code, so
 * a second run replaces the same shapes and adds nothing. Everything runs
 * in one transaction.
 *
 * UKHSA does not use the ONS codes for everything:
 *
 * - It reports two pairs of local authorities as single areas, so those
 *   boundaries are merged (see `COMBINED_AREAS`).
 * - It identifies regions with `E45` codes, where ONS uses `E12` (see
 *   `REGIONS`). The shapes are stored on the `E45` areas.
 *
 * An existing ONS area keeps its name and level (the ETL sets them from
 * UKHSA); only its boundary, centroid and parent are written here.
 *
 * It also loads the Natural Earth countries and US states (see
 * `loadNaturalEarth`), from `data/natural-earth/`.
 *
 * Run with `pnpm db:boundaries`. It uses the direct connection
 * (`DATABASE_URL_UNPOOLED`).
 */
import { readFileSync } from "node:fs";
import { sql, type SQL } from "drizzle-orm";
import { createDb } from "../../src/db/client.ts";
import { COUNTRY_CODE_SCHEME, US_STATE_CODE_SCHEME } from "./country-codes.mts";
import { COMBINED_AREAS, MERGED_AWAY, REGIONS } from "./ukhsa-codes.mts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is not set");
}

const CODE_SCHEME = "ons";

type Feature = {
  properties: { code: string; name: string };
  geometry: unknown;
};

/** Reads a committed GeoJSON file into a map from ONS code to feature. */
function readFeatures(path: string): Map<string, Feature> {
  const collection = JSON.parse(readFileSync(path, "utf8")) as {
    features: Feature[];
  };
  return new Map(
    collection.features.map((feature) => [feature.properties.code, feature]),
  );
}

/** Returns the features with the given codes, or fails if one is missing. */
function pick(features: Map<string, Feature>, codes: string[], file: string) {
  return codes.map((code) => {
    const feature = features.get(code);
    if (!feature) throw new Error(`${file} has no feature for ${code}`);
    return feature;
  });
}

/**
 * An SQL expression for a valid multi-polygon built from one or more
 * GeoJSON geometries (merged if there is more than one).
 */
function boundarySql(features: Feature[]): SQL {
  const shapes = features.map(
    (feature) =>
      sql`ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}::text), 4326))`,
  );
  const merged = shapes.length === 1 ? shapes[0] : sql`ST_Union(ARRAY[${sql.join(shapes, sql`, `)}])`;
  // ST_CollectionExtract keeps only polygons, in case repairing a shape
  // leaves stray lines or points behind.
  return sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(${merged}), 3))`;
}

const lads = readFeatures("data/ons/lad-dec-2022-england.geojson");
const regions = readFeatures("data/ons/rgn-dec-2022-england.geojson");

// Every area to write: its code, its name, its level and its shape.
const toLoad: {
  code: string;
  name: string;
  level: "region" | "lower_tier_local_authority";
  boundary: SQL;
}[] = [];

for (const [onsCode, feature] of lads) {
  if (MERGED_AWAY.has(onsCode)) continue;
  const combined = COMBINED_AREAS[onsCode];
  toLoad.push({
    code: onsCode,
    name: combined?.name ?? feature.properties.name,
    level: "lower_tier_local_authority",
    boundary: boundarySql(
      combined ? pick(lads, combined.onsCodes, "the LAD file") : [feature],
    ),
  });
}
for (const [e12Code, region] of Object.entries(REGIONS)) {
  toLoad.push({
    code: region.code,
    name: region.name,
    level: "region",
    boundary: boundarySql(pick(regions, [e12Code], "the region file")),
  });
}
for (const code of regions.keys()) {
  if (!(code in REGIONS)) throw new Error(`No UKHSA code is mapped for region ${code}`);
}

/** A database transaction, as `db.transaction` passes it to its callback. */
type Transaction = Parameters<Parameters<ReturnType<typeof createDb>["db"]["transaction"]>[0]>[0];

/**
 * Loads the Natural Earth countries (`iso3166-1-alpha3`, level `country`) and
 * US states (`iso3166-2`, level `region`, with the `USA` country as parent).
 * Only the code, name, level and a centroid are written: the shapes are drawn
 * from the static files in `public/boundaries/`, and nothing queries them, so
 * they stay out of the database. Nothing else sets these areas' names, so
 * here a second run does update them.
 *
 * @throws If the files do not hold the expected 242 countries and 51 states,
 *   or a state has no parent.
 */
async function loadNaturalEarth(tx: Transaction) {
  const countries = [...readFeatures("data/natural-earth/countries-50m.geojson").values()];
  const states = [...readFeatures("data/natural-earth/us-states-50m.geojson").values()];
  if (countries.length !== 242) throw new Error(`Expected 242 countries, got ${countries.length}`);
  if (states.length !== 51) throw new Error(`Expected 51 US states, got ${states.length}`);

  const sets = [
    { scheme: COUNTRY_CODE_SCHEME, level: "country", features: countries },
    { scheme: US_STATE_CODE_SCHEME, level: "region", features: states },
  ] as const;
  for (const { scheme, level, features } of sets) {
    for (const feature of features) {
      const shape = sql`ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}::text), 4326))`;
      await tx.execute(sql`
        INSERT INTO areas (code_scheme, code, name, level, centroid)
        VALUES (${scheme}, ${feature.properties.code}, ${feature.properties.name}, ${level},
                ST_PointOnSurface(${shape})::geography)
        ON CONFLICT (code_scheme, code) DO UPDATE
          SET name = excluded.name, level = excluded.level, centroid = excluded.centroid`);
    }
  }

  await tx.execute(sql`
    UPDATE areas AS state
    SET parent_id = country.id
    FROM areas AS country
    WHERE state.code_scheme = ${US_STATE_CODE_SCHEME} AND state.code LIKE 'US-%'
      AND country.code_scheme = ${COUNTRY_CODE_SCHEME} AND country.code = 'USA'`);
  const orphans = await tx.execute<{ code: string }>(sql`
    SELECT code FROM areas
    WHERE code_scheme = ${US_STATE_CODE_SCHEME} AND code LIKE 'US-%' AND parent_id IS NULL`);
  if (orphans.rows.length > 0) {
    throw new Error(`US states with no parent: ${orphans.rows.map((row) => row.code).join(", ")}`);
  }
  return { countries: countries.length, states: states.length };
}

const { db, pool } = createDb(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
try {
  const report = await db.transaction(async (tx) => {
    let inserted = 0;
    let updated = 0;
    for (const area of toLoad) {
      const result = await tx.execute<{ inserted: boolean }>(sql`
        INSERT INTO areas (code_scheme, code, name, level, boundary)
        VALUES (${CODE_SCHEME}, ${area.code}, ${area.name}, ${area.level}, ${area.boundary})
        ON CONFLICT (code_scheme, code) DO UPDATE SET boundary = excluded.boundary
        RETURNING (xmax = 0) AS inserted`);
      if (result.rows[0].inserted) inserted += 1;
      else updated += 1;
    }

    const codes = toLoad.map((area) => area.code);
    const codeList = sql`(${sql.join(
      codes.map((code) => sql`${code}`),
      sql`, `,
    )})`;

    await tx.execute(sql`
      UPDATE areas
      SET centroid = ST_PointOnSurface(boundary)::geography
      WHERE code_scheme = ${CODE_SCHEME} AND code IN ${codeList}`);

    // The parent of a local authority is the region that contains its
    // centroid. The centroid is always inside the shape, so this is
    // unambiguous even where generalised edges do not line up exactly.
    await tx.execute(sql`
      UPDATE areas AS lad
      SET parent_id = region.id
      FROM areas AS region
      WHERE lad.code_scheme = ${CODE_SCHEME}
        AND lad.level = 'lower_tier_local_authority'
        AND lad.code IN ${codeList}
        AND region.code_scheme = ${CODE_SCHEME}
        AND region.level = 'region'
        AND ST_Contains(region.boundary, lad.centroid::geometry)`);

    const withoutBoundary = await tx.execute<{ code: string; name: string }>(sql`
      SELECT code, name FROM areas AS a
      WHERE code_scheme = ${CODE_SCHEME} AND boundary IS NULL
        AND EXISTS (SELECT 1 FROM observations o WHERE o.area_id = a.id)
      ORDER BY code`);
    const withoutObservations = await tx.execute<{ count: string }>(sql`
      SELECT count(*) FROM areas AS a
      WHERE code_scheme = ${CODE_SCHEME} AND code IN ${codeList}
        AND NOT EXISTS (SELECT 1 FROM observations o WHERE o.area_id = a.id)`);
    const withoutParent = await tx.execute<{ code: string; name: string }>(sql`
      SELECT code, name FROM areas
      WHERE code_scheme = ${CODE_SCHEME}
        AND level = 'lower_tier_local_authority'
        AND code IN ${codeList} AND parent_id IS NULL
      ORDER BY code`);

    // Natural Earth: every country, and the US states under the United States.
    const naturalEarth = await loadNaturalEarth(tx);

    return {
      naturalEarth,
      inserted,
      updated,
      withoutBoundary: withoutBoundary.rows,
      withoutObservations: Number(withoutObservations.rows[0].count),
      withoutParent: withoutParent.rows,
    };
  });

  const list = (rows: { code: string; name: string }[]) =>
    rows.length === 0 ? "none" : rows.map((r) => `${r.code} ${r.name}`).join(", ");
  console.log(
    `Areas loaded: ${toLoad.length} (${report.inserted} added, ${report.updated} updated).`,
  );
  console.log(`Areas with observations but no boundary: ${list(report.withoutBoundary)}`);
  console.log(
    `Boundaries for areas with no observations yet: ${report.withoutObservations}`,
  );
  console.log(`Local authorities with no parent region: ${list(report.withoutParent)}`);
  console.log(
    `Natural Earth: ${report.naturalEarth.countries} countries and ${report.naturalEarth.states} US states loaded.`,
  );
} finally {
  await pool.end();
}
