import { connection } from "next/server";
import { Suspense } from "react";
import { loadDiseaseSeries } from "@/lib/data/series";
import { getDisease, headlineDatasets } from "@/lib/datasets/registry";
import type { DiseaseSeries } from "@/lib/series-types";
import { DiseaseChartPlaces } from "./charts/DiseaseChartPlaces";

/** The data-driven part. It waits for a real request before it touches the database. */
async function ChartData({ slug, name }: { slug: string; name: string }) {
  await connection();
  const disease = getDisease(slug);
  if (!disease) return null;
  const datasets = headlineDatasets(slug);
  const results = await Promise.all(
    datasets.map(async (dataset) => ({ dataset, result: await loadDiseaseSeries(slug, dataset.id) })),
  );
  // A place with no figures yet is left out. If no place has any, say so.
  const places = results.flatMap(({ dataset, result }) =>
    result.status === "ok"
      ? [{ placeName: dataset.place.name, series: result.data satisfies DiseaseSeries }]
      : [],
  );
  if (places.length === 0) {
    const failed = results.some(({ result }) => result.status === "error");
    return (
      <p role="status" className="rounded-md border border-line bg-surface p-5 text-muted">
        {failed
          ? "The chart can’t be loaded at the moment. Please try again later."
          : "There’s no chart yet, because the weekly figures haven’t been loaded."}
      </p>
    );
  }
  return (
    <DiseaseChartPlaces
      places={places}
      diseaseName={name}
      sinceLabel={`Since ${disease.chart.since.slice(0, 4)}`}
    />
  );
}

/**
 * The weekly chart of a disease. The page around it is static; the chart
 * streams in, so a slow database never delays the rest of the page. A disease
 * with data for more than one place (COVID-19) has a choice of place.
 *
 * @param slug - A disease slug that was checked against the registry.
 */
export function DiseaseChart({ slug, name }: { slug: string; name: string }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex aspect-[4/3] items-center justify-center rounded-md border border-line bg-surface text-muted sm:aspect-[2/1]"
        >
          Loading the chart&hellip;
        </div>
      }
    >
      <ChartData slug={slug} name={name} />
    </Suspense>
  );
}
