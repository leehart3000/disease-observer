/**
 * Loads a small, known set of observations for the end-to-end tests, so the
 * map page has values to show. It first deletes every observation in the
 * database, so the data is always exactly this set.
 *
 * It only ever runs against a database called `disease_observer_test` on
 * this machine (`localhost`, `127.0.0.1` or the `db` container). It
 * refuses anything else, so it can never touch the real development
 * database or a production one.
 *
 * Run with `pnpm e2e:fixtures` (or `pnpm test:e2e:db`, which also creates
 * and prepares the database). It needs `pnpm db:seed` and `pnpm
 * db:boundaries` first, because it uses the areas and sources they create.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "../../src/db/client.ts";
import { areas, diseases, observations, sources } from "../../src/db/schema.ts";
import { englandRows, fixtureDates } from "./dates.mts";

export const TEST_DATABASE_NAME = "disease_observer_test";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "db"];

/**
 * Checks that a connection string points at the local test database.
 *
 * @throws If the host is not local or the database name is not `disease_observer_test`.
 */
export function assertTestDatabase(connectionString: string | undefined): string {
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED is not set");
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(
      `Refusing to load fixtures: the host "${url.hostname}" is not local (${LOCAL_HOSTS.join(", ")})`,
    );
  }
  if (name !== TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing to load fixtures: the database must be "${TEST_DATABASE_NAME}", not "${name}"`,
    );
  }
  return connectionString;
}

/**
 * Thirty local authorities, which the tests use by name. That is enough for
 * a second page of the table (it shows 25 rows at a time). The first twelve
 * have the high values (20 to 410.5); the rest have low ones (1 to 9.5).
 */
const LOCAL_AUTHORITIES = [
  "E06000001", // Hartlepool
  "E06000002", // Middlesbrough
  "E06000003", // Redcar and Cleveland
  "E06000004", // Stockton-on-Tees
  "E06000005", // Darlington
  "E06000006", // Halton
  "E06000007", // Warrington
  "E06000008", // Blackburn with Darwen
  "E06000009", // Blackpool
  "E06000010", // Kingston upon Hull, City of
  "E06000011", // East Riding of Yorkshire
  "E06000012", // North East Lincolnshire
  "E06000013", // North Lincolnshire
  "E06000014", // York
  "E06000015", // Derby
  "E06000016", // Leicester
  "E06000017", // Rutland
  "E06000018", // Nottingham
  "E06000019", // Herefordshire, County of
  "E06000020", // Telford and Wrekin
  "E06000021", // Stoke-on-Trent
  "E06000022", // Bath and North East Somerset
  "E06000023", // Bristol, City of
  "E06000024", // North Somerset
  "E06000025", // South Gloucestershire
  "E06000026", // Plymouth
  "E06000027", // Torbay
  "E06000030", // Swindon
  "E06000031", // Peterborough
  "E06000032", // Luton
];

/** The nine regions, as UKHSA codes them. */
const REGIONS = [
  "E45000009",
  "E45000018",
  "E45000010",
  "E45000016",
  "E45000005",
  "E45000017",
  "E45000001",
  "E45000019",
  "E45000020",
];

/** Measles cases for each region in the last complete week. Four regions have none. */
const MEASLES_CASES = [0, 0, 0, 0, 1, 2, 3, 5, 8];

/** Loads the fixtures. */
async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local file: use the real environment.
  }
  const url = assertTestDatabase(process.env.DATABASE_URL_UNPOOLED);
  const dates = fixtureDates();

  const { db, pool } = createDb(url, { max: 1 });
  try {
    await db.transaction(async (tx) => {
      const [source] = await tx.select().from(sources).where(eq(sources.slug, "ukhsa"));
      const diseaseRows = await tx
        .select()
        .from(diseases)
        .where(inArray(diseases.slug, ["covid-19", "measles"]));
      const covid = diseaseRows.find((row) => row.slug === "covid-19");
      const measles = diseaseRows.find((row) => row.slug === "measles");
      if (!source || !covid || !measles) {
        throw new Error("Run `pnpm db:seed` first: the UKHSA source or a disease is missing");
      }

      const areaRows = await tx
        .select({ id: areas.id, code: areas.code })
        .from(areas)
        .where(
          and(
            eq(areas.codeScheme, "ons"),
            inArray(areas.code, [...LOCAL_AUTHORITIES, ...REGIONS]),
          ),
        );
      const areaId = new Map(areaRows.map((row) => [row.code, row.id]));
      const idOf = (code: string) => {
        const id = areaId.get(code);
        if (id === undefined) {
          throw new Error(`Run \`pnpm db:boundaries\` first: area ${code} is missing`);
        }
        return id;
      };

      type Row = typeof observations.$inferInsert;
      const rows: Row[] = [];
      const base = { sourceId: source.id, stratum: "all", periodType: "week" as const };

      LOCAL_AUTHORITIES.forEach((code, index) => {
        const covidBase = { ...base, diseaseId: covid.id, areaId: idOf(code), metric: "rate_per_100k" };
        rows.push({
          ...covidBase,
          periodStart: dates.covidLatest.start,
          periodEnd: dates.covidLatest.end,
          value: index < 12 ? 20 + index * 35.5 : 1 + (index - 12) * 0.5,
          // Three areas are still inside UKHSA's reporting delay.
          provisional: index < 3,
        });
        rows.push({
          ...covidBase,
          periodStart: dates.covidPrevious.start,
          periodEnd: dates.covidPrevious.end,
          value: 5,
          provisional: false,
        });
      });

      REGIONS.forEach((code, index) => {
        const measlesBase = { ...base, diseaseId: measles.id, areaId: idOf(code), metric: "cases" };
        rows.push({
          ...measlesBase,
          periodStart: dates.measlesComplete.start,
          periodEnd: dates.measlesComplete.end,
          value: MEASLES_CASES[index],
          // Two regions are provisional.
          provisional: index >= 7,
        });
        rows.push({
          ...measlesBase,
          periodStart: dates.measlesIncomplete.start,
          periodEnd: dates.measlesIncomplete.end,
          value: 99,
          provisional: true,
        });
      });

      // England is not in the boundary files, so the loader creates it, as the ETL does.
      const [england] = await tx
        .insert(areas)
        .values({ codeScheme: "ons", code: "E92000001", name: "England", level: "nation" })
        .onConflictDoUpdate({
          target: [areas.codeScheme, areas.code],
          set: { name: sql`excluded.name` },
        })
        .returning({ id: areas.id });
      const englandSeries = englandRows(dates);
      for (const row of englandSeries.covid) {
        rows.push({
          ...base,
          diseaseId: covid.id,
          areaId: england.id,
          metric: "rate_per_100k",
          periodStart: row.start,
          periodEnd: row.end,
          value: row.value,
          provisional: row.provisional,
        });
      }
      for (const row of englandSeries.measles) {
        rows.push({
          ...base,
          diseaseId: measles.id,
          areaId: england.id,
          metric: "cases",
          periodStart: row.start,
          periodEnd: row.end,
          value: row.value,
          provisional: row.provisional,
        });
      }

      await tx.delete(observations);
      await tx.insert(observations).values(rows).onConflictDoUpdate({
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
          periodEnd: sql`excluded.period_end`,
          value: sql`excluded.value`,
          provisional: sql`excluded.provisional`,
        },
      });
      console.log(`Loaded ${rows.length} fixture observations into ${TEST_DATABASE_NAME}.`);
    });
  } finally {
    await pool.end();
  }
}

// Only run when started directly (not when imported by the setup script).
if (import.meta.main) {
  await main();
}
