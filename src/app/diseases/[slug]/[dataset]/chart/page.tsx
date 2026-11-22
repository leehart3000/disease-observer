import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ViewTabs } from "@/components/ViewTabs";
import { DATASETS, getDatasetBySlug, getDisease } from "@/lib/datasets/registry";
import { datasetHref, diseaseHref, viewHref, viewTabs } from "@/lib/datasets/routes";
import { canonicalFor } from "@/lib/seo";
import { ChartSection } from "./ChartSection";

/** Whether a dataset has a chart page: it lists the view, and its chart shows every area. */
function hasChartPage(dataset: { views: readonly string[]; chart: { mode: string } }): boolean {
  return dataset.views.includes("chart") && dataset.chart.mode === "all-areas";
}

/** Every dataset with a chart page is built ahead of time. */
export function generateStaticParams() {
  return DATASETS.filter(hasChartPage).map((dataset) => ({
    slug: dataset.diseaseSlug,
    dataset: dataset.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/diseases/[slug]/[dataset]/chart">): Promise<Metadata> {
  const { slug, dataset: datasetSlug } = await params;
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!dataset) return {};
  return {
    title: `${dataset.label}: chart`,
    description: dataset.description,
    // `?range=` is a state of this page, not a separate page.
    alternates: canonicalFor(viewHref(dataset, "chart")),
  };
}

/**
 * A dataset's chart page, for a dataset with few areas: England and every
 * region over time, with the time range in the address. The breadcrumb,
 * heading and view links are static; the chart streams in.
 */
export default async function ChartViewPage({
  params,
  searchParams,
}: PageProps<"/diseases/[slug]/[dataset]/chart">) {
  const { slug, dataset: datasetSlug } = await params;
  const disease = getDisease(slug);
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!disease || !dataset || !hasChartPage(dataset)) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Diseases", href: "/diseases" },
          { label: disease.name, href: diseaseHref(disease.slug) },
          { label: dataset.name, href: datasetHref(dataset) },
          { label: "Chart", href: viewHref(dataset, "chart") },
        ]}
      />
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{dataset.label}</h1>
      <p className="mt-3 mb-6 max-w-2xl text-lg text-muted">{dataset.description}</p>
      <div className="mb-6">
        <ViewTabs datasetName={dataset.name} tabs={viewTabs(dataset)} current="chart" />
      </div>
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
        <ChartSection disease={disease} dataset={dataset} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
