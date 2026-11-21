import { connection } from "next/server";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { MapExplorer } from "@/components/map/MapExplorer";
import { loadMapData } from "@/lib/map/data";

/**
 * The map page's data-driven part. It waits for a real request before it
 * touches the database, so nothing is queried while the site is built. The
 * values themselves come from a cache that refreshes about once a day.
 */
export async function MapSection() {
  await connection();
  const result = await loadMapData();
  if (result.status !== "ok") return <DataUnavailable reason={result.status} />;
  return <MapExplorer data={result.data} />;
}
