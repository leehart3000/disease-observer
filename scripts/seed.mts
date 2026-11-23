/**
 * Adds the first data sources and diseases. Safe to run more than once:
 * existing rows are updated, not duplicated.
 *
 * Run with `pnpm db:seed`. It uses the direct connection
 * (`DATABASE_URL_UNPOOLED`).
 */
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client.ts";
import { SOURCES } from "../src/lib/credits.ts";
import { diseases, sources } from "../src/db/schema.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is not set");
}

// The credits are written once, in code (`src/lib/credits.ts`), which the
// pages read; this writes the same rows into the `sources` table.
const sourceRows = [...SOURCES];

const diseaseRows = [
  { slug: "covid-19", name: "COVID-19" },
  { slug: "measles", name: "Measles" },
  { slug: "influenza", name: "Influenza" },
  { slug: "rsv", name: "RSV" },
];

const { db, pool } = createDb(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
try {
  // One transaction, so either both tables are seeded or neither is.
  await db.transaction(async (tx) => {
    await tx
      .insert(sources)
      .values(sourceRows)
      .onConflictDoUpdate({
        target: sources.slug,
        set: {
          name: sql`excluded.name`,
          url: sql`excluded.url`,
          licenceName: sql`excluded.licence_name`,
          licenceUrl: sql`excluded.licence_url`,
          attribution: sql`excluded.attribution`,
        },
      });
    await tx
      .insert(diseases)
      .values(diseaseRows)
      .onConflictDoUpdate({
        target: diseases.slug,
        set: { name: sql`excluded.name` },
      });
  });
  console.log(
    `Seeded ${sourceRows.length} sources and ${diseaseRows.length} diseases.`,
  );
} finally {
  await pool.end();
}
