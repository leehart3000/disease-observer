import { connection } from "next/server";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { Sources } from "@/components/map/Sources";
import { ValuesTable } from "@/components/ValuesTable";
import { loadMapValues } from "@/lib/data/map-values";
import { loadSources } from "@/lib/data/sources";
import { viewHref } from "@/lib/datasets/routes";
import type { DatasetDef } from "@/lib/datasets/types";
import { parseMapSelection, type SearchParams } from "@/lib/datasets/url";

/**
 * The table page's data-driven part. It reads the period and the chosen
 * areas from the URL, and waits for a real request before it touches the
 * database. The values are the same cached ones as the map's, so the table
 * costs nothing extra.
 *
 * Areas in the URL (`?areas=`) are only used if they are in the dataset;
 * their rows are highlighted. If the values can't be loaded, the rest of the
 * page still shows.
 */
export async function TableSection({
  dataset,
  searchParams,
}: {
  dataset: DatasetDef;
  searchParams: Promise<SearchParams>;
}) {
  const { period, areas } = parseMapSelection(dataset, await searchParams);
  await connection();
  const [values, sources] = await Promise.all([loadMapValues(dataset, period), loadSources()]);
  if (values.status !== "ok") return <DataUnavailable reason={values.status} />;

  const inData = new Set(values.data.values.map((area) => area.code));
  const credits =
    sources.status === "ok"
      ? dataset.sourceSlugs.flatMap((slug) => sources.data.filter((source) => source.slug === slug))
      : null;
  return (
    <>
      <ValuesTable
        dataset={dataset}
        values={values.data}
        areaCount={null}
        action={{
          kind: "link",
          mapPath: viewHref(dataset, "map"),
          selected: areas.filter((code) => inData.has(code)),
        }}
      />
      <Sources credits={credits} />
    </>
  );
}
