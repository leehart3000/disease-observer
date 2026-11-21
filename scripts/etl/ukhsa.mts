/**
 * Loads UKHSA data dashboard data into the database: COVID-19 cases and
 * case rates for England, the UKHSA regions and the lower tier local
 * authorities, and measles cases for England and the UKHSA regions. Safe to run more than once: rows are only changed when the
 * value or the provisional flag differs.
 *
 * Run with `pnpm etl:ukhsa`. It uses the direct connection
 * (`DATABASE_URL_UNPOOLED`) and needs `pnpm db:seed` to have run.
 *
 * With no options (the default mode) it loads COVID-19 for the current
 * year, plus last year in January. Measles always loads its full history.
 *
 * Options:
 * - `--from=YYYY`: backfill COVID-19 from that year instead.
 * - `--limit=N`: only load the first N local authorities, for testing.
 * - `--only=nation,region,lad`: only load those kinds of area (England, the
 *   UKHSA regions, the local authorities). Use `--from=2023 --only=nation,region`
 *   to backfill England and the regions without reloading every local authority.
 *
 * The run is recorded in `etl_runs`. It fails, and the process exits with
 * a non-zero code, if more than 5% of the geographies of one type fail or
 * if anything else goes wrong.
 */
import { parseArgs } from "node:util";
import { and, eq, lt, sql } from "drizzle-orm";
import { createDb, type Database } from "../../src/db/client.ts";
import {
  areas,
  diseases,
  etlRuns,
  observations,
  sources,
} from "../../src/db/schema.ts";
import { createHttpClient, NotFoundError, type HttpClient } from "./http.mts";
import { fetchGeographyNames, fetchSeries } from "./ukhsa-api.mts";
import {
  DATASETS,
  dedupeObservations,
  parseOnly,
  selectDatasets,
  toObservationFields,
  yearsForBackfill,
  yearsForDefaultRun,
  type DatasetConfig,
  type ObservationFields,
} from "./ukhsa-transform.mts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

const SOURCE_SLUG = "ukhsa";
/** The ONS (GSS) codes that UKHSA uses for areas. */
const CODE_SCHEME = "ons";
/** A dataset fails if more than this share of its geographies fail. */
const MAX_FAILURE_SHARE = 0.05;
const BATCH_SIZE = 1000;
const STALE_RUN_MESSAGE = "Marked as failed: still running after more than an hour";

/** Totals for the whole run. */
type Totals = {
  geographies: number;
  failedGeographies: number;
  rowsSeen: number;
  rowsChanged: number;
  warnings: string[];
  failures: string[];
};

type Context = {
  db: Database;
  http: HttpClient;
  sourceId: number;
  diseaseIds: Map<string, number>;
  totals: Totals;
};

const { values: args } = parseArgs({
  options: {
    from: { type: "string" },
    limit: { type: "string" },
    only: { type: "string" },
  },
  strict: true,
});

/** Reads a whole-number option, or exits with a clear message. */
function readIntegerOption(name: string, value: string | undefined, min: number) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < min) {
    throw new Error(`--${name} must be a whole number of at least ${min}`);
  }
  return number;
}

/** Joins messages for `etl_runs.error_message`, keeping it short. */
function summarise(messages: string[], limit = 10): string {
  const shown = messages.slice(0, limit).join("; ");
  const more = messages.length > limit ? ` (and ${messages.length - limit} more)` : "";
  return `${shown}${more}`.slice(0, 2000);
}

/** Inserts or updates one area by its code and returns its id. */
async function upsertArea(
  db: Database,
  code: string,
  name: string,
  level: DatasetConfig["areaLevel"],
): Promise<number> {
  // Only the name is updated. Boundary, centroid and parent are set by
  // other jobs and must survive.
  const [row] = await db
    .insert(areas)
    .values({ codeScheme: CODE_SCHEME, code, name, level })
    .onConflictDoUpdate({
      target: [areas.codeScheme, areas.code],
      set: { name: sql`excluded.name` },
    })
    .returning({ id: areas.id });
  return row.id;
}

/**
 * Writes observations in batches. A row is only updated when its value or
 * provisional flag changes, so `retrieved_at` means "when the stored value
 * last changed".
 *
 * @returns The number of rows inserted or updated.
 */
async function upsertObservations(
  ctx: Context,
  diseaseId: number,
  areaId: number,
  rows: ObservationFields[],
): Promise<number> {
  let changed = 0;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE).map((row) => ({
      ...row,
      diseaseId,
      areaId,
      sourceId: ctx.sourceId,
    }));
    const result = await ctx.db
      .insert(observations)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          observations.sourceId,
          observations.diseaseId,
          observations.areaId,
          observations.metric,
          observations.stratum,
          observations.periodType,
          observations.periodStart,
        ],
        set: {
          value: sql`excluded.value`,
          periodEnd: sql`excluded.period_end`,
          provisional: sql`excluded.provisional`,
          retrievedAt: sql`now()`,
        },
        setWhere: sql`${observations.value} is distinct from excluded.value
          or ${observations.provisional} is distinct from excluded.provisional`,
      })
      .returning({ id: observations.id });
    changed += result.length;
  }
  return changed;
}

/**
 * Fetches and stores every series for one geography. Nothing is written if
 * any request fails, so a geography is either fully updated or untouched.
 */
async function loadGeography(
  ctx: Context,
  dataset: DatasetConfig,
  geography: string,
  years: Array<number | undefined>,
): Promise<void> {
  const rows: ObservationFields[] = [];
  const codes = new Set<string>();
  let areaName = geography;
  let sawNotFound = false;

  for (const series of dataset.series) {
    for (const year of years) {
      let result;
      try {
        result = await fetchSeries(ctx.http, {
          subTheme: dataset.subTheme,
          topic: dataset.topic,
          geographyType: dataset.geographyType,
          geography,
          metric: series.ukhsaMetric,
          year,
          defaultStratumOnly: dataset.defaultStratumOnly,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          sawNotFound = true;
          ctx.totals.warnings.push(`${geography}: ${series.ukhsaMetric} not found`);
          break;
        }
        throw error;
      }
      const unique = dedupeObservations(
        result.points.flatMap((point) => {
          codes.add(point.geography_code);
          areaName = point.geography;
          const fields = toObservationFields(point, series);
          return fields ? [fields] : [];
        }),
      );
      if (unique.length < result.reportedCount && result.points.length > 0) {
        ctx.totals.warnings.push(
          `${geography}: ${series.ukhsaMetric}${year ? ` ${year}` : ""} has ${unique.length} distinct rows but the API reported ${result.reportedCount}`,
        );
      }
      rows.push(...unique);
    }
  }

  if (codes.size === 0) {
    if (!sawNotFound) ctx.totals.warnings.push(`${geography}: no data`);
    return;
  }
  if (codes.size > 1) {
    throw new Error(`more than one geography code (${[...codes].join(", ")})`);
  }

  const diseaseId = ctx.diseaseIds.get(dataset.diseaseSlug);
  if (diseaseId === undefined) throw new Error(`Unknown disease ${dataset.diseaseSlug}`);
  const areaId = await upsertArea(ctx.db, [...codes][0], areaName, dataset.areaLevel);

  // One last pass over everything for this area, so that no batch can
  // contain the same key twice.
  const unique = dedupeObservations(rows);
  ctx.totals.rowsSeen += unique.length;
  ctx.totals.rowsChanged += await upsertObservations(ctx, diseaseId, areaId, unique);
}

/** Loads every geography of one dataset. */
async function loadDataset(
  ctx: Context,
  dataset: DatasetConfig,
  years: number[],
  limit: number | undefined,
): Promise<void> {
  let names = await fetchGeographyNames(ctx.http, dataset);
  if (limit !== undefined && dataset.areaLevel === "lower_tier_local_authority") {
    names = names.slice(0, limit);
  }
  const yearFilters = dataset.byYear ? years : [undefined];
  console.log(
    `${dataset.name}: ${names.length} geographies, ${dataset.series.length} metrics, ` +
      `${dataset.byYear ? `years ${years[0]}-${years.at(-1)}` : "full history"}`,
  );

  const changedBefore = ctx.totals.rowsChanged;
  let failed = 0;
  for (const [index, geography] of names.entries()) {
    try {
      await loadGeography(ctx, dataset, geography, yearFilters);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      ctx.totals.failures.push(`${geography}: ${message}`);
      console.error(`  FAILED ${geography}: ${message}`);
      if (failed / names.length > MAX_FAILURE_SHARE) {
        console.error(`  More than 5% of geographies failed, so stopping this dataset.`);
        ctx.totals.geographies += index + 1;
        ctx.totals.failedGeographies += failed;
        return;
      }
    }
    if ((index + 1) % 10 === 0 || index + 1 === names.length) {
      console.log(
        `  ${index + 1}/${names.length} geographies, ` +
          `${ctx.totals.rowsChanged - changedBefore} rows changed so far, ` +
          `${ctx.http.requestCount()} requests`,
      );
    }
  }
  ctx.totals.geographies += names.length;
  ctx.totals.failedGeographies += failed;
}

/** Finds the ids of the source and diseases that the seed created. */
async function loadReferenceIds(db: Database) {
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.slug, SOURCE_SLUG));
  if (!source) throw new Error(`Source "${SOURCE_SLUG}" not found. Run pnpm db:seed first.`);

  const diseaseRows = await db.select({ id: diseases.id, slug: diseases.slug }).from(diseases);
  const diseaseIds = new Map(diseaseRows.map((row) => [row.slug, row.id]));
  for (const dataset of DATASETS) {
    if (!diseaseIds.has(dataset.diseaseSlug)) {
      throw new Error(`Disease "${dataset.diseaseSlug}" not found. Run pnpm db:seed first.`);
    }
  }
  return { sourceId: source.id, diseaseIds };
}

async function main(): Promise<void> {
  const fromYear = readIntegerOption("from", args.from, 2019);
  const limit = readIntegerOption("limit", args.limit, 1);
  const only = args.only === undefined ? undefined : parseOnly(args.only);
  const datasets = selectDatasets(DATASETS, only);
  const now = new Date();
  const years = fromYear === undefined ? yearsForDefaultRun(now) : yearsForBackfill(fromYear, now);

  const { db, pool } = createDb(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
  let runId: number | undefined;
  try {
    const { sourceId, diseaseIds } = await loadReferenceIds(db);

    // A run that was killed leaves its row as "running" for ever.
    const stale = await db
      .update(etlRuns)
      .set({ status: "failed", finishedAt: sql`now()`, errorMessage: STALE_RUN_MESSAGE })
      .where(
        and(
          eq(etlRuns.sourceId, sourceId),
          eq(etlRuns.status, "running"),
          lt(etlRuns.startedAt, sql`now() - interval '1 hour'`),
        ),
      )
      .returning({ id: etlRuns.id });
    if (stale.length > 0) console.warn(`Marked ${stale.length} stale run(s) as failed`);

    const [run] = await db
      .insert(etlRuns)
      .values({ sourceId })
      .returning({ id: etlRuns.id });
    runId = run.id;
    console.log(`ETL run ${runId} started`);

    const ctx: Context = {
      db,
      http: createHttpClient(),
      sourceId,
      diseaseIds,
      totals: {
        geographies: 0,
        failedGeographies: 0,
        rowsSeen: 0,
        rowsChanged: 0,
        warnings: [],
        failures: [],
      },
    };

    let failed = false;
    for (const dataset of datasets) {
      const failuresBefore = ctx.totals.failedGeographies;
      const geographiesBefore = ctx.totals.geographies;
      await loadDataset(ctx, dataset, years, limit);
      const datasetGeographies = ctx.totals.geographies - geographiesBefore;
      const datasetFailures = ctx.totals.failedGeographies - failuresBefore;
      if (datasetFailures / Math.max(datasetGeographies, 1) > MAX_FAILURE_SHARE) failed = true;
    }

    const { totals } = ctx;
    for (const warning of totals.warnings.slice(0, 20)) console.warn(`  Warning: ${warning}`);
    if (totals.warnings.length > 20) {
      console.warn(`  ...and ${totals.warnings.length - 20} more warnings`);
    }
    console.log(
      `Done: ${totals.geographies} geographies (${totals.failedGeographies} failed), ` +
        `${totals.warnings.length} warnings, ${totals.rowsSeen} rows read, ` +
        `${totals.rowsChanged} rows inserted or updated, ${ctx.http.requestCount()} requests`,
    );

    await db
      .update(etlRuns)
      .set({
        status: failed ? "failed" : "succeeded",
        finishedAt: sql`now()`,
        rowCount: totals.rowsChanged,
        errorMessage: totals.failures.length > 0 ? summarise(totals.failures) : null,
      })
      .where(eq(etlRuns.id, runId));
    if (failed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ETL run failed: ${message}`);
    if (runId !== undefined) {
      await db
        .update(etlRuns)
        .set({ status: "failed", finishedAt: sql`now()`, errorMessage: message.slice(0, 2000) })
        .where(eq(etlRuns.id, runId));
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await main();
