import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DiseaseChart } from "@/components/DiseaseChart";
import { DiseaseHeadline } from "@/components/Headline";
import { strongLink } from "@/components/link-styles";
import { SourcesFallback, SourcesSection } from "@/components/SourcesSection";
import {
  DISEASES,
  datasetsForDisease,
  getDisease,
  sourceSlugsForDisease,
} from "@/lib/datasets/registry";
import { diseaseHref } from "@/lib/datasets/routes";
import { mapHref } from "@/lib/datasets/url";
import { canonicalFor } from "@/lib/seo";

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
  };
}

/**
 * A disease page: a description, a link to each of its maps, and its
 * sources. The text and links come from the registry, so they show even if
 * the database is down. An unknown slug is a 404.
 */
export default async function DiseasePage({ params }: PageProps<"/diseases/[slug]">) {
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

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Maps</h2>
      <ul className="grid max-w-2xl gap-4">
        {datasetsForDisease(disease.slug).map((dataset) => (
          <li key={dataset.id}>
            <Link
              href={mapHref(dataset.id)}
              prefetch
              className={`${strongLink} inline-flex min-h-11 items-center text-lg`}
            >
              {dataset.label}
            </Link>
            <p className="text-muted">{dataset.description}</p>
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
