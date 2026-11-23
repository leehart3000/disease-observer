/**
 * Loads CDC National Healthcare Safety Network (NHSN) hospital respiratory
 * data into the database: new hospital admissions per 100,000 people for
 * influenza, RSV and COVID-19, for the United States as a whole and for each
 * state (and the District of Columbia), one value a week. Safe to run more
 * than once: rows are only changed when the value or the provisional flag
 * differs.
 *
 * Run with `pnpm etl:cdc-nhsn`. It uses the direct connection
 * (`DATABASE_URL_UNPOOLED`), and needs `pnpm db:seed` (the source and the
 * diseases) and `pnpm db:boundaries` (the country and state areas) to have run.
 *
 * It makes one request. With no options it loads weeks from 2023. `--from=YYYY`
 * loads from that year instead (the dataset starts in 2020). The territories
 * and HHS regions in the dataset are left out. The latest week of each series is
 * marked provisional.
 *
 * The run is recorded in `etl_runs`, and fails, with a non-zero exit code, if
 * anything goes wrong (for example a jurisdiction it does not know).
 */
import { parseArgs } from "node:util";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { createDb, type Database } from "../../src/db/client.ts";
import { areas, diseases, etlRuns, observations, sources } from "../../src/db/schema.ts";
import { fetchRows } from "./cdc-nhsn-api.mts";
import {
  areasOf,
  buildSeries,
  DISEASE_COLUMNS,
  type AreaKey,
} from "./cdc-nhsn-transform.mts";
import { createHttpClient } from "./http.mts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

const SOURCE_SLUG = "cdc-nhsn";
/** Weeks from this year are loaded when `--from` is not given. */
const DEFAULT_FROM_YEAR = 2023;
/** The dataset starts in August 2020. */
const FIRST_YEAR = 2020;
const BATCH_SIZE = 1000;
const STALE_RUN_MESSAGE = "Marked as failed: still running after more than an hour";

const { values: args } = parseArgs({ options: { from: { type: "string" } }, strict: true });

/** Reads `--from=YYYY`, or returns the default. */
function readFromYear(value: string | undefined): number {
  if (value === undefined) return DEFAULT_FROM_YEAR;
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || year < FIRST_YEAR || year > new Date().getUTCFullYear()) {
    throw new Error(`--from must be a four-digit year from ${FIRST_YEAR} to this year`);
  }
  return year;
}

/** The ids of the source, the diseases and the areas that the seed and the boundary loader created. */
async function loadReferenceIds(db: Database, needed: AreaKey[]) {
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.slug, SOURCE_SLUG));
  if (!source) throw new Error(`Source "${SOURCE_SLUG}" not found. Run pnpm db:seed first.`);

  const diseaseRows = await db.select({ id: diseases.id, slug: diseases.slug }).from(diseases);
  const diseaseIds = new Map(diseaseRows.map((row) => [row.slug, row.id]));
  for (const { diseaseSlug } of DISEASE_COLUMNS) {
    if (!diseaseIds.has(diseaseSlug)) {
      throw new Error(`Disease "${diseaseSlug}" not found. Run pnpm db:seed first.`);
    }
  }

  const schemes = [...new Set(needed.map((area) => area.scheme))];
  const areaRows = await db
    .select({ id: areas.id, scheme: areas.codeScheme, code: areas.code })
    .from(areas)
    .where(inArray(areas.codeScheme, schemes));
  const areaIds = new Map(areaRows.map((row) => [`${row.scheme}|${row.code}`, row.id]));
  const missing = needed.filter((area) => !areaIds.has(`${area.scheme}|${area.code}`));
  if (missing.length > 0) {
    throw new Error(
      `Areas not found: ${missing.map((area) => area.code).join(", ")}. Run pnpm db:boundaries first.`,
    );
  }
  return { sourceId: source.id, diseaseIds, areaIds };
}

/**
 * Writes observations in batches. A row is only updated when its value or
 * provisional flag changes, so `retrieved_at` means "when the stored value
 * last changed".
 *
 * @returns The number of rows inserted or updated.
 */
async function upsertObservations(
  db: Database,
  rows: (typeof observations.$inferInsert)[],
): Promise<number> {
  let changed = 0;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const result = await db
      .insert(observations)
      .values(rows.slice(start, start + BATCH_SIZE))
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

async function main(): Promise<void> {
  const fromYear = readFromYear(args.from);
  const { db, pool } = createDb(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
  let runId: number | undefined;
  try {
    const [source] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.slug, SOURCE_SLUG));
    if (!source) throw new Error(`Source "${SOURCE_SLUG}" not found. Run pnpm db:seed first.`);

    // A run that was killed leaves its row as "running" for ever.
    const stale = await db
      .update(etlRuns)
      .set({ status: "failed", finishedAt: sql`now()`, errorMessage: STALE_RUN_MESSAGE })
      .where(
        and(
          eq(etlRuns.sourceId, source.id),
          eq(etlRuns.status, "running"),
          lt(etlRuns.startedAt, sql`now() - interval '1 hour'`),
        ),
      )
      .returning({ id: etlRuns.id });
    if (stale.length > 0) console.warn(`Marked ${stale.length} stale run(s) as failed`);

    const [run] = await db.insert(etlRuns).values({ sourceId: source.id }).returning({ id: etlRuns.id });
    runId = run.id;
    console.log(`ETL run ${runId} started (weeks from ${fromYear})`);

    const http = createHttpClient();
    const rows = await fetchRows(http, fromYear);
    const series = buildSeries(rows);
    if (series.length === 0) throw new Error("The dataset returned no usable rows");
    const { sourceId, diseaseIds, areaIds } = await loadReferenceIds(db, areasOf(series));

    const toWrite = series.flatMap(({ area, diseaseSlug, observations: list }) =>
      list.map((observation) => ({
        ...observation,
        sourceId,
        diseaseId: diseaseIds.get(diseaseSlug)!,
        areaId: areaIds.get(`${area.scheme}|${area.code}`)!,
      })),
    );
    const changed = await upsertObservations(db, toWrite);
    console.log(
      `Done: ${rows.length} rows read, ${series.length} series, ${toWrite.length} observations, ` +
        `${changed} inserted or updated, ${http.requestCount()} request(s)`,
    );

    await db
      .update(etlRuns)
      .set({ status: "succeeded", finishedAt: sql`now()`, rowCount: changed, errorMessage: null })
      .where(eq(etlRuns.id, runId));
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
