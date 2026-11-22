/**
 * Adds the first data sources and diseases. Safe to run more than once:
 * existing rows are updated, not duplicated.
 *
 * Run with `pnpm db:seed`. It uses the direct connection
 * (`DATABASE_URL_UNPOOLED`).
 */
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client.ts";
import { diseases, sources } from "../src/db/schema.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is not set");
}

const sourceRows = [
  {
    slug: "ukhsa",
    name: "UKHSA data dashboard",
    url: "https://ukhsa-dashboard.data.gov.uk/",
    licenceName: "Open Government Licence v3.0",
    licenceUrl:
      "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    attribution:
      "Contains public sector information licensed under the Open Government Licence v3.0.",
  },
  {
    slug: "ons-geography",
    name: "Office for National Statistics: Open Geography Portal",
    url: "https://geoportal.statistics.gov.uk/",
    licenceName: "Open Government Licence v3.0",
    licenceUrl:
      "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    attribution:
      "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2022.",
  },
  {
    slug: "natural-earth",
    name: "Natural Earth",
    url: "https://www.naturalearthdata.com/",
    licenceName: "Public domain",
    licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
    attribution: "Made with Natural Earth.",
  },
  {
    slug: "who-flunet",
    name: "WHO FluNet",
    url: "https://www.who.int/tools/flunet",
    licenceName: "WHO terms and conditions for datasets",
    licenceUrl:
      "https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions",
    attribution:
      "Data from WHO FluNet, Global Influenza Surveillance and Response System (GISRS), World Health Organization.",
  },
];

const diseaseRows = [
  { slug: "covid-19", name: "COVID-19" },
  { slug: "measles", name: "Measles" },
  { slug: "influenza", name: "Influenza" },
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
