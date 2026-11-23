import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DiseaseChart } from "@/components/DiseaseChart";
import { DiseaseHeadline } from "@/components/Headline";
import { strongLink, textLink } from "@/components/link-styles";
import { PageFallback } from "@/components/PageFallback";
import { SourcesFallback, SourcesSection } from "@/components/SourcesSection";
import {
  DISEASES,
  datasetsForDisease,
  getDisease,
  sourceSlugsForDisease,
} from "@/lib/datasets/registry";
import { datasetHref, diseaseHref, VIEW_LABELS, viewHref } from "@/lib/datasets/routes";
import { canonicalFor, socialMetadata } from "@/lib/seo";

/** Every disease in the registry is built ahead of time. */
export function generateStaticParams() {
  return DISEASES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/diseases/[slug]">): Promise<Metadata> {
  const disease = getDisease((await params).slug);
  if (!disease) return {};
  return {
    title: disease.name,
    description: disease.summary,
    alternates: canonicalFor(diseaseHref(disease.slug)),
    ...socialMetadata(`${disease.name} | Disease Observer`, disease.summary, diseaseHref(disease.slug)),
  };
}

/**
 * A disease page: a description, a link to each of its maps, and its
 * sources. The text and links come from the registry, so they show even if
 * the database is down. An unknown slug is a 404.
 */
export default function DiseasePage(props: PageProps<"/diseases/[slug]">) {
  // `params` is read inside the boundary, so the route's shared App Shell
  // holds nothing that belongs to one address (a direct visit still gets the
  // whole page, because every disease is built ahead of time).
  return (
    <Suspense fallback={<PageFallback />}>
      <DiseaseContent {...props} />
    </Suspense>
  );
}

async function DiseaseContent({ params }: PageProps<"/diseases/[slug]">) {
  const disease = getDisease((await params).slug);
  if (!disease) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Diseases", href: "/diseases" },
          { label: disease.name, href: diseaseHref(disease.slug) },
        ]}
      />
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{disease.name}</h1>
      <div className="mt-3 grid max-w-2xl gap-3">
        <p className="text-lg text-muted">{disease.summary}</p>
        {disease.about.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-8 max-w-sm rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-medium">Latest figure</h2>
        <DiseaseHeadline slug={disease.slug} id="headline" />
      </div>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Over time</h2>
      <DiseaseChart slug={disease.slug} name={disease.name} />

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Datasets</h2>
      <ul className="grid max-w-2xl gap-5">
        {datasetsForDisease(disease.slug).map((dataset) => (
          <li key={dataset.id}>
            <Link
              href={datasetHref(dataset)}
              prefetch
              className={`${strongLink} inline-flex min-h-11 items-center text-lg`}
            >
              {dataset.name}
            </Link>
            <p className="text-muted">{dataset.description}</p>
            {/* One link for each view that has a page. */}
            <ul className="flex flex-wrap gap-x-4" aria-label={`Views of ${dataset.name}`}>
              {dataset.views.map((view) => (
                <li key={view}>
                  <Link
                    href={viewHref(dataset, view)}
                    prefetch
                    // The visible text starts the name, so the two agree.
                    aria-label={`${VIEW_LABELS[view]}: ${dataset.name}`}
                    className={`${textLink} inline-flex min-h-11 items-center`}
                  >
                    {VIEW_LABELS[view]}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Sources</h2>
      <div className="max-w-2xl text-sm text-muted">
        <Suspense fallback={<SourcesFallback />}>
          <SourcesSection slugs={sourceSlugsForDisease(disease.slug)} />
        </Suspense>
      </div>
    </main>
  );
}
