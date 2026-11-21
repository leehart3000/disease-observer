/**
 * The credits and licences of the data sources, from the `sources` table.
 * Server-side only. Nothing here may run at build time.
 */
import "server-only";
import { cacheLife } from "next/cache";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import type { SourceCredit } from "@/lib/map/types";
import { loadWithFallback, type LoadResult } from "./load";

/** Reads every row of the `sources` table. Not cached. */
export async function querySources(): Promise<SourceCredit[]> {
  const rows = await getDb().select().from(sources).orderBy(sources.name);
  return rows.map(({ slug, name, url, licenceName, licenceUrl, attribution }) => ({
    slug,
    name,
    url,
    licenceName,
    licenceUrl,
    attribution,
  }));
}

/** The same rows, from the shared runtime cache (refreshed about once a day). */
async function getCachedSources(): Promise<SourceCredit[]> {
  "use cache: remote";
  cacheLife("days");
  return querySources();
}

/**
 * Loads the credits without ever throwing: from the cache, else from the
 * database, else as an "error" result.
 */
export function loadSources(): Promise<LoadResult<SourceCredit[]>> {
  return loadWithFallback("Sources", getCachedSources, querySources);
}
