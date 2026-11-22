import { connection } from "next/server";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { MapExplorer } from "@/components/map/MapExplorer";
import { PeriodPicker } from "@/components/PeriodPicker";
import { loadMapValues } from "@/lib/data/map-values";
import { loadSources } from "@/lib/data/sources";
import { parseMapSelection, type SearchParams } from "@/lib/datasets/url";
import type { DatasetDef } from "@/lib/datasets/types";

/**
 * The map page's data-driven part. It reads the period and the pinned area
 * from the URL, and waits for a real request before it touches the
 * database, so nothing is queried while the site is built. The values
 * themselves come from a cache that refreshes about once a day.
 *
 * A pinned area in the URL (`?areas=E06000001`) is only used if it is one of
 * the dataset's areas; anything else is ignored. If the values can't be
 * loaded, the rest of the page (the heading and breadcrumb) still shows.
 */
export async function MapSection({
  dataset,
  searchParams,
}: {
  dataset: DatasetDef;
  searchParams: Promise<SearchParams>;
}) {
  const { period, areas } = parseMapSelection(dataset, await searchParams);
  await connection();
  const [values, sources] = await Promise.all([loadMapValues(dataset, period), loadSources()]);

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

  const pinnedArea = areas
    .map((code) => values.data.values.find((area) => area.code === code))
    .find((area) => area !== undefined);
  return (
    <div className="grid gap-4">
      {picker}
      <MapExplorer
        datasetId={dataset.id}
        values={values.data}
        sources={sources.status === "ok" ? sources.data : null}
        initialPinned={pinnedArea ? { code: pinnedArea.code, name: pinnedArea.name } : null}
      />
    </div>
  );
}
