import { connection } from "next/server";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { DatasetPicker } from "@/components/map/DatasetPicker";
import { MapExplorer } from "@/components/map/MapExplorer";
import { parseMapSelection, type SearchParams } from "@/lib/datasets/url";
import { loadMapValues } from "@/lib/data/map-values";
import { loadSources } from "@/lib/data/sources";

/**
 * The map page's data-driven part. It reads the dataset from the URL, and
 * waits for a real request before it touches the database, so nothing is
 * queried while the site is built. The values themselves come from a cache
 * that refreshes about once a day.
 *
 * If the values can't be loaded, the dataset picker is still shown, so the
 * visitor can try another dataset.
 */
export async function MapSection({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { dataset, period } = parseMapSelection(await searchParams);
  await connection();
  const [values, sources] = await Promise.all([loadMapValues(dataset, period), loadSources()]);

  if (values.status !== "ok") {
    return (
      <div className="grid gap-4">
        <DatasetPicker selectedId={dataset.id} />
        <DataUnavailable reason={values.status} />
      </div>
    );
  }
  return (
    <MapExplorer
      datasetId={dataset.id}
      values={values.data}
      sources={sources.status === "ok" ? sources.data : null}
    />
  );
}
