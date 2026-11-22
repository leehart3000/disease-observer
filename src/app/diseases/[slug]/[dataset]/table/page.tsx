import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ViewTabs } from "@/components/ViewTabs";
import { DATASETS, getDatasetBySlug, getDisease } from "@/lib/datasets/registry";
import { datasetHref, diseaseHref, viewHref, viewTabs } from "@/lib/datasets/routes";
import { canonicalFor } from "@/lib/seo";
import { TableSection } from "./TableSection";

/** Every dataset with a table page is built ahead of time. */
export function generateStaticParams() {
  return DATASETS.filter((dataset) => dataset.views.includes("table")).map((dataset) => ({
    slug: dataset.diseaseSlug,
    dataset: dataset.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/diseases/[slug]/[dataset]/table">): Promise<Metadata> {
  const { slug, dataset: datasetSlug } = await params;
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!dataset) return {};
  return {
    title: `${dataset.label}: table`,
    description: dataset.description,
    // `?areas=` is a state of this page, not a separate page.
    alternates: canonicalFor(viewHref(dataset, "table")),
  };
}

/**
 * A dataset's table page: every figure in a table that can be searched,
 * sorted and paged, with no map. The breadcrumb, heading and view links are
 * static; the table streams in.
 */
export default async function TableViewPage({
  params,
  searchParams,
}: PageProps<"/diseases/[slug]/[dataset]/table">) {
  const { slug, dataset: datasetSlug } = await params;
  const disease = getDisease(slug);
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!disease || !dataset || !dataset.views.includes("table")) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Diseases", href: "/diseases" },
          { label: disease.name, href: diseaseHref(disease.slug) },
          { label: dataset.name, href: datasetHref(dataset) },
          { label: "Table", href: viewHref(dataset, "table") },
        ]}
      />
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{dataset.label}</h1>
      <p className="mt-3 mb-6 max-w-2xl text-lg text-muted">{dataset.description}</p>
      <div className="mb-6">
        <ViewTabs datasetName={dataset.name} tabs={viewTabs(dataset)} current="table" />
      </div>
      <Suspense
        fallback={
          <div
            role="status"
            className="flex h-64 items-center justify-center rounded-md border border-line bg-surface text-muted"
          >
            Loading the table&hellip;
          </div>
        }
      >
        <TableSection dataset={dataset} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
