import { connection } from "next/server";
import { LineChart } from "@/components/charts/LineChart";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { Sources } from "@/components/map/Sources";
import { loadSources } from "@/lib/data/sources";
import { loadDiseaseSeries } from "@/lib/data/series";
import type { DatasetDef, DiseaseDef } from "@/lib/datasets/types";
import { parseChartRange, type SearchParams } from "@/lib/datasets/url";

/**
 * The chart page's data-driven part. It reads the range from the URL
 * (`?range=all`, checked, so anything else is the last 12 months) and waits
 * for a real request before it touches the database. If the series can't be
 * loaded, the rest of the page still shows.
 *
 * The series is the disease's headline dataset, which is this dataset for
 * the datasets that have an `all-areas` chart.
 */
export async function ChartSection({
  disease,
  dataset,
  searchParams,
}: {
  disease: DiseaseDef;
  dataset: DatasetDef;
  searchParams: Promise<SearchParams>;
}) {
  const range = parseChartRange(await searchParams);
  await connection();
  const [series, sources] = await Promise.all([loadDiseaseSeries(disease.slug), loadSources()]);
  const credits =
    sources.status === "ok"
      ? dataset.sourceSlugs.flatMap((slug) => sources.data.filter((source) => source.slug === slug))
      : null;
  return (
    <>
      {series.status === "ok" ? (
        <LineChart
          series={series.data}
          diseaseName={disease.name}
          sinceLabel={`Since ${disease.chart.since.slice(0, 4)}`}
          initialRange={range}
          rangeInUrl
        />
      ) : (
        <DataUnavailable reason={series.status} />
      )}
      <Sources credits={credits} />
    </>
  );
}
