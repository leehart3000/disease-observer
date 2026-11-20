import { defineConfig } from "drizzle-kit";

// Local development values. In CI and production the variables are already set.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file: use the real environment.
}

/**
 * Drizzle Kit setup. Migrations use the direct (unpooled) connection, and
 * PostGIS's own tables and views are left out of schema comparisons.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
  extensionsFilters: ["postgis"],
  tablesFilter: [
    "!spatial_ref_sys",
    "!geography_columns",
    "!geometry_columns",
    "!raster_columns",
    "!raster_overviews",
  ],
});
