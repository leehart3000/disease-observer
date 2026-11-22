import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DATASETS, getDatasetBySlug, getDisease } from "@/lib/datasets/registry";
import { datasetHref, diseaseHref, viewHref } from "@/lib/datasets/routes";
import { canonicalFor } from "@/lib/seo";
import { MapSection } from "./MapSection";

/** Every dataset with a map page is built ahead of time. */
export function generateStaticParams() {
  return DATASETS.filter((dataset) => dataset.views.includes("map")).map((dataset) => ({
    slug: dataset.diseaseSlug,
    dataset: dataset.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/diseases/[slug]/[dataset]/map">): Promise<Metadata> {
  const { slug, dataset: datasetSlug } = await params;
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!dataset) return {};
  return {
    title: `${dataset.label}: map`,
    description: dataset.description,
    // `?p=` and `?areas=` are states of this page, not separate pages.
    alternates: canonicalFor(viewHref(dataset, "map")),
  };
}

/**
 * A dataset's map page: the breadcrumb and heading are static; the map and
 * table stream in. The period and a pinned area are in the URL.
 */
export default async function MapViewPage({
  params,
  searchParams,
}: PageProps<"/diseases/[slug]/[dataset]/map">) {
  const { slug, dataset: datasetSlug } = await params;
  const disease = getDisease(slug);
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!disease || !dataset || !dataset.views.includes("map")) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Diseases", href: "/diseases" },
          { label: disease.name, href: diseaseHref(disease.slug) },
          { label: dataset.name, href: datasetHref(dataset) },
          { label: "Map", href: viewHref(dataset, "map") },
        ]}
      />
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{dataset.label}</h1>
      <p className="mt-3 mb-6 max-w-2xl text-lg text-muted">{dataset.description}</p>
      <Suspense
        fallback={
          <div
            role="status"
            className="flex h-[26rem] items-center justify-center rounded-md border border-line bg-surface text-muted lg:h-[36rem]"
          >
            Loading the map&hellip;
          </div>
        }
      >
        <MapSection dataset={dataset} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
