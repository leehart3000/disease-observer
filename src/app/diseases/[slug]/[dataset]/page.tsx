import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageFallback } from "@/components/PageFallback";
import { SourcesFallback, SourcesSection } from "@/components/SourcesSection";
import { ViewCards } from "@/components/ViewCards";
import { DATASETS, getDatasetBySlug, getDisease } from "@/lib/datasets/registry";
import { datasetHref, diseaseHref } from "@/lib/datasets/routes";
import { canonicalFor } from "@/lib/seo";

/** Every dataset in the registry is built ahead of time. */
export function generateStaticParams() {
  return DATASETS.map((dataset) => ({ slug: dataset.diseaseSlug, dataset: dataset.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/diseases/[slug]/[dataset]">): Promise<Metadata> {
  const { slug, dataset: datasetSlug } = await params;
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!dataset) return {};
  return {
    title: dataset.label,
    description: dataset.description,
    alternates: canonicalFor(datasetHref(dataset)),
  };
}

/**
 * A dataset's own page: what it shows, how to read a value, the views it
 * has (as cards), and its sources. The text comes from the registry, so it
 * shows even if the database is down. An unknown disease or dataset is a 404.
 */
export default function DatasetPage(props: PageProps<"/diseases/[slug]/[dataset]">) {
  // `params` is read inside the boundary, so the route's shared App Shell
  // holds nothing that belongs to one address (a direct visit still gets the
  // whole page, because every dataset is built ahead of time).
  return (
    <Suspense fallback={<PageFallback />}>
      <DatasetContent {...props} />
    </Suspense>
  );
}

async function DatasetContent({ params }: PageProps<"/diseases/[slug]/[dataset]">) {
  const { slug, dataset: datasetSlug } = await params;
  const disease = getDisease(slug);
  const dataset = getDatasetBySlug(slug, datasetSlug);
  if (!disease || !dataset) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Diseases", href: "/diseases" },
          { label: disease.name, href: diseaseHref(disease.slug) },
          { label: dataset.name, href: datasetHref(dataset) },
        ]}
      />
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{dataset.label}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{dataset.description}</p>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">How to read it</h2>
      <p className="max-w-2xl">{dataset.howToRead}</p>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Ways to look at it</h2>
      <ViewCards dataset={dataset} />

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Sources</h2>
      <div className="max-w-2xl text-sm text-muted">
        <Suspense fallback={<SourcesFallback />}>
          <SourcesSection slugs={dataset.sourceSlugs} />
        </Suspense>
      </div>
    </main>
  );
}
