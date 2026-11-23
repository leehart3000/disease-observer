import { connection } from "next/server";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { MapExplorer } from "@/components/map/MapExplorer";
import { PeriodPicker } from "@/components/PeriodPicker";
import { loadMapValues } from "@/lib/data/map-values";
import { creditsFor } from "@/lib/credits";
import { parseMapSelection, type SearchParams } from "@/lib/datasets/url";
import type { DatasetDef } from "@/lib/datasets/types";

/**
 * The map page's data-driven part. It reads the period from the URL, and
 * waits for a real request before it touches the database, so nothing is
 * queried while the site is built. The values themselves come from a cache
 * that refreshes about once a day.
 *
 * The pinned area (`?areas=E06000001`) is read from the address by the map
 * itself, and only used if it is one of the dataset's areas. If the values
 * can't be loaded, the rest of the page (the heading and breadcrumb) still shows.
 */
export async function MapSection({
  dataset,
  searchParams,
}: {
  dataset: DatasetDef;
  searchParams: Promise<SearchParams>;
}) {
  const { period } = parseMapSelection(dataset, await searchParams);
  await connection();
  const values = await loadMapValues(dataset, period);

  // The choice of period stays even if the values can't be loaded, so another can be tried.
  const picker = <PeriodPicker periods={dataset.periods} period={period} note={dataset.periodNote} />;
  if (values.status !== "ok") {
    return (
      <div className="grid gap-4">
        {picker}
        <DataUnavailable reason={values.status} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {picker}
      <MapExplorer
        datasetId={dataset.id}
        values={values.data}
        sources={creditsFor(dataset.sourceSlugs)}
      />
    </div>
  );
}
