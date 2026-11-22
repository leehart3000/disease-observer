import { connection } from "next/server";
import { AreaChart } from "@/components/charts/AreaChart";
import { LineChart } from "@/components/charts/LineChart";
import { DataUnavailable } from "@/components/map/DataUnavailable";
import { Sources } from "@/components/map/Sources";
import { ENGLAND_CODE, loadAreaIndex, loadAreaSeries } from "@/lib/data/areas";
import { loadDiseaseSeries } from "@/lib/data/series";
import { loadSources } from "@/lib/data/sources";
import type { DatasetDef, DiseaseDef } from "@/lib/datasets/types";
import { parseAreaCodes, parseChartRange, type SearchParams } from "@/lib/datasets/url";
import { composeSeries, MAX_COMPARED_AREAS } from "@/lib/series-compose";

/**
 * The chart for a dataset whose chart compares areas (`pick-areas`): England,
 * and the areas in `?areas=`.
 *
 * The codes in the address are checked against the dataset's area index
 * before any series is loaded, so a code that is not an area costs nothing
 * and never reaches a cache key. Unknown and repeated codes are dropped, and
 * only the first three valid ones are used. A chosen area whose figures
 * can't be loaded is left off, and the page says so.
 */
async function AreaComparison({
  disease,
  dataset,
  params,
}: {
  disease: DiseaseDef;
  dataset: DatasetDef;
  params: SearchParams;
}) {
  const [index, england] = await Promise.all([
    loadAreaIndex(dataset),
    loadAreaSeries(dataset, ENGLAND_CODE),
  ]);
  if (index.status !== "ok") return <DataUnavailable reason={index.status} />;
  if (england.status !== "ok") return <DataUnavailable reason={england.status} />;

  const known = new Set(index.data.map((area) => area.code));
  const wanted = parseAreaCodes(params.areas, 10)
    .filter((code) => known.has(code))
    .slice(0, MAX_COMPARED_AREAS);
  const loaded = await Promise.all(wanted.map((code) => loadAreaSeries(dataset, code)));
  const chosen = loaded.flatMap((result) => (result.status === "ok" ? [result.data] : []));
  const missing = wanted.length - chosen.length;
  return (
    <>
      {missing > 0 ? (
        <p role="status" className="mb-3 rounded-md border border-line bg-surface p-3 text-muted">
          The figures for {missing === 1 ? "one chosen area" : `${missing} chosen areas`} can’t be
          loaded at the moment, so {missing === 1 ? "it is" : "they are"} not on the chart.
        </p>
      ) : null}
      <AreaChart
        series={composeSeries(disease.slug, dataset.id, england.data, chosen)}
        options={index.data}
        diseaseName={disease.name}
        sinceLabel={`Since ${disease.chart.since.slice(0, 4)}`}
        initialRange={parseChartRange(params)}
        noun={dataset.map.areaNounOne}
        nounPlural={dataset.map.areaNoun}
      />
    </>
  );
}

/**
 * The chart page's data-driven part. It reads the range and the chosen areas
 * from the URL (both checked) and waits for a real request before it touches
 * the database. If the data can't be loaded, the rest of the page still shows.
 *
 * - `all-areas` (few areas): the disease's series, England and every region.
 * - `pick-areas` (many areas): England and up to three chosen areas.
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
  const params = await searchParams;
  await connection();
  // The chart and the credits are siblings, so they load at the same time.
  return (
    <>
      {dataset.chart.mode === "pick-areas" ? (
        <AreaComparison disease={disease} dataset={dataset} params={params} />
      ) : (
        <AllAreasChart disease={disease} params={params} />
      )}
      <ChartSources dataset={dataset} />
    </>
  );
}

/** The chart of a dataset with few areas: the disease's series, England and every region. */
async function AllAreasChart({ disease, params }: { disease: DiseaseDef; params: SearchParams }) {
  // The disease's series is its headline dataset's, which is this dataset.
  const series = await loadDiseaseSeries(disease.slug);
  if (series.status !== "ok") return <DataUnavailable reason={series.status} />;
  return (
    <LineChart
      series={series.data}
      diseaseName={disease.name}
      sinceLabel={`Since ${disease.chart.since.slice(0, 4)}`}
      initialRange={parseChartRange(params)}
      rangeInUrl
    />
  );
}

/** The credits of the dataset's sources, or a note if they can't be loaded. */
async function ChartSources({ dataset }: { dataset: DatasetDef }) {
  const sources = await loadSources();
  const credits =
    sources.status === "ok"
      ? dataset.sourceSlugs.flatMap((slug) => sources.data.filter((source) => source.slug === slug))
      : null;
  return <Sources credits={credits} />;
}
