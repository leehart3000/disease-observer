/**
 * Database schema for Disease Observer, defined with Drizzle ORM.
 *
 * Geometry and geography columns use PostGIS in SRID 4326 (WGS 84,
 * longitude and latitude).
 *
 * The seed script runs this file directly with Node's type stripping, so
 * it must use only erasable TypeScript syntax (no `enum`, `namespace` or
 * parameter properties), and relative imports need `.ts` extensions.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Builds a PostGIS `geometry` column type in SRID 4326.
 *
 * Reads return a hex-encoded extended well-known binary (EWKB) string,
 * which is how PostGIS sends geometry to the driver. Writes accept WKT
 * (`POLYGON((...))`), EWKT (`SRID=4326;...`) or hex EWKB, so a value read
 * from the database can be written back unchanged. The value is cast to
 * `geometry`, given SRID 4326 and converted to a multi-part geometry
 * (`ST_Multi`), so a single `POLYGON` is stored as a `MultiPolygon`.
 *
 * Do not use `sql.placeholder()` for these columns. To write GeoJSON, use
 * `ST_GeomFromGeoJSON` in a `sql` expression. Use `ST_AsText` or
 * `ST_AsGeoJSON` in a query to read a readable form.
 */
const geometry = (geometryType: "MultiPolygon" | "Point") =>
  customType<{ data: string }>({
    dataType() {
      return `geometry(${geometryType}, 4326)`;
    },
    toDriver(value: string) {
      return sql`ST_Multi(ST_SetSRID(${value}::geometry, 4326))`;
    },
  });

/**
 * Builds a PostGIS `geography` column type in SRID 4326.
 *
 * Distances on a geography column are in metres, so `ST_DWithin` takes a
 * radius in metres and can use the GiST index. Reads return hex EWKB.
 * Writes accept WKT, EWKT or hex EWKB (cast to `geography`), so a value
 * read from the database can be written back unchanged. The same rules
 * about `sql.placeholder()` and GeoJSON apply as for `geometry`.
 */
const geography = (geometryType: "Point") =>
  customType<{ data: string }>({
    dataType() {
      return `geography(${geometryType},4326)`;
    },
    toDriver(value: string) {
      return sql`${value}::geography`;
    },
  });

/**
 * The values allowed in `areas.level`. `nation` means a UK nation
 * (England, Scotland, Wales or Northern Ireland). `country` means a
 * sovereign state, as used in WHO data.
 */
export const AREA_LEVELS = [
  "nation",
  "region",
  "upper_tier_local_authority",
  "lower_tier_local_authority",
  "country",
  "other",
] as const;

/** The length of time that one observation covers. */
export const periodType = pgEnum("period_type", ["day", "week", "month"]);

/** The outcome of an ETL run. */
export const etlRunStatus = pgEnum("etl_run_status", [
  "running",
  "succeeded",
  "failed",
]);

/** Organisations that publish the data, with the licence and credit to show. */
export const sources = pgTable("sources", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** Stable identifier used in code and URLs, for example `ukhsa`. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  licenceName: text("licence_name").notNull(),
  licenceUrl: text("licence_url").notNull(),
  /** Credit line shown on the site wherever this source's data appears. */
  attribution: text("attribution").notNull(),
});

/** Diseases that the site reports on. */
export const diseases = pgTable("diseases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  /** Stable identifier used in code and URLs, for example `covid-19`. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

/** Places that observations are reported for, with their map shapes. */
export const areas = pgTable(
  "areas",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** The official scheme that `code` belongs to, such as `ons` or `iso3166-1-alpha3`. */
    codeScheme: text("code_scheme").notNull(),
    /** Stable code within the scheme, such as an ONS code or an ISO 3166 code. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    level: text("level", { enum: AREA_LEVELS }).notNull(),
    /** The area that contains this one, such as the region of a local authority. */
    parentId: integer("parent_id"),
    /** Outline of the area. */
    boundary: geometry("MultiPolygon")("boundary"),
    /**
     * A representative point, used for labels and "within a distance of"
     * queries. It is a geography, so distances are in metres.
     */
    centroid: geography("Point")("centroid"),
  },
  (table) => [
    unique("areas_code_scheme_code_key").on(table.codeScheme, table.code),
    check(
      "areas_level_check",
      sql`${table.level} in (${sql.raw(AREA_LEVELS.map((level) => `'${level}'`).join(", "))})`,
    ),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "areas_parent_id_fkey",
    }).onDelete("set null"),
    index("areas_parent_id_idx").on(table.parentId),
    index("areas_boundary_gist_idx").using("gist", table.boundary),
    index("areas_centroid_gist_idx").using("gist", table.centroid),
  ],
);

/** One measured value for a disease, area, source, metric, stratum and period. */
export const observations = pgTable(
  "observations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    diseaseId: integer("disease_id")
      .notNull()
      .references(() => diseases.id),
    areaId: integer("area_id")
      .notNull()
      .references(() => areas.id),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    /** What was measured, for example `cases` or `rate_per_100k`. */
    metric: text("metric").notNull(),
    /**
     * The slice of the population or cases that the value covers, for
     * example `age:0-4` or `subtype:A/H3`. `all` means no breakdown.
     */
    stratum: text("stratum").notNull().default("all"),
    /** First day of the period, inclusive. */
    periodStart: date("period_start", { mode: "string" }).notNull(),
    /** Last day of the period, inclusive. */
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    periodType: periodType("period_type").notNull(),
    value: doublePrecision("value").notNull(),
    /** When the value was downloaded from the source. */
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    // Lets an import update existing rows instead of adding duplicates.
    unique("observations_natural_key").on(
      table.sourceId,
      table.diseaseId,
      table.areaId,
      table.metric,
      table.stratum,
      table.periodType,
      table.periodStart,
    ),
    check(
      "observations_period_check",
      sql`${table.periodEnd} >= ${table.periodStart}`,
    ),
    index("observations_disease_period_idx").on(
      table.diseaseId,
      table.periodStart,
    ),
    index("observations_area_disease_period_idx").on(
      table.areaId,
      table.diseaseId,
      table.periodStart,
    ),
  ],
);

/** A record of each import from a source, for monitoring. */
export const etlRuns = pgTable(
  "etl_runs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** Empty while the run is still going. */
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: etlRunStatus("status").notNull().default("running"),
    /** Number of observation rows inserted or updated. */
    rowCount: integer("row_count"),
    errorMessage: text("error_message"),
  },
  (table) => [index("etl_runs_source_started_idx").on(table.sourceId, table.startedAt)],
);
