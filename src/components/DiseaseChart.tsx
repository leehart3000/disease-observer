import { connection } from "next/server";
import { Suspense } from "react";
import { loadDiseaseSeries } from "@/lib/data/series";
import { getDisease } from "@/lib/datasets/registry";
import { LineChart } from "./charts/LineChart";

/** The data-driven part. It waits for a real request before it touches the database. */
async function ChartData({ slug, name }: { slug: string; name: string }) {
  await connection();
  const disease = getDisease(slug);
  if (!disease) return null;
  const result = await loadDiseaseSeries(slug);
  if (result.status !== "ok") {
    return (
      <p role="status" className="rounded-md border border-line bg-surface p-5 text-muted">
        {result.status === "error"
          ? "The chart can’t be loaded at the moment. Please try again later."
          : "There’s no chart yet, because the weekly figures haven’t been loaded."}
      </p>
    );
  }
  return (
    <LineChart
      series={result.data}
      diseaseName={name}
      sinceLabel={`Since ${disease.chart.since.slice(0, 4)}`}
    />
  );;
}

/**
 * The weekly chart of a disease. The page around it is static; the chart
 * streams in, so a slow database never delays the rest of the page.
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
