import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DatasetHeadline } from "@/components/Headline";
import { strongLink, textLink } from "@/components/link-styles";
import { PageFallback } from "@/components/PageFallback";
import { diseaseInSentence, joinList } from "@/lib/datasets/registry";
import {
  datasetHref,
  diseaseHref,
  LOCATIONS_HREF,
  locationHref,
  placeViewHref,
  VIEW_LABELS,
} from "@/lib/datasets/routes";
import { allLocations, diseasesForLocation, getLocation, placePhrase } from "@/lib/locations";
import { canonicalFor } from "@/lib/seo";

/** Every place that has data is built ahead of time. */
export function generateStaticParams() {
  return allLocations().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/locations/[slug]">): Promise<Metadata> {
  const place = getLocation((await params).slug);
  if (!place) return {};
  const diseases = diseasesForLocation(place.slug).map(({ disease }) => diseaseInSentence(disease.name));
  return {
    title: place.name,
    description: `Infectious disease figures for ${placePhrase(place.slug)}: ${joinList(diseases)}.`,
    alternates: canonicalFor(locationHref(place.slug)),
  };
}

/**
 * The page of a place: every disease that has data for it, with each
 * dataset's latest figure and links to its map, chart and table. The text and
 * links come from the registry, so they show even if the database is down; the
 * figures stream in. An unknown place, or one with no data, is a 404.
 *
 * It reads `params` inside the `Suspense` boundary, like the dataset pages, so
 * the route's shared App Shell holds nothing that belongs to one address.
 */
export default function LocationPage(props: PageProps<"/locations/[slug]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <LocationContent {...props} />
    </Suspense>
  );
}

async function LocationContent({ params }: PageProps<"/locations/[slug]">) {
  const place = getLocation((await params).slug);
  if (!place) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Locations", href: LOCATIONS_HREF },
          { label: place.name, href: locationHref(place.slug) },
        ]}
      />
      <h1 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">{place.name}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Every disease the site has figures for in {placePhrase(place.slug)}, with its latest figure
        and links to its map, chart and table.
      </p>

      {diseasesForLocation(place.slug).map(({ disease, datasets }) => (
        <section key={disease.slug} aria-labelledby={`place-${disease.slug}`} className="mt-10">
          <h2 id={`place-${disease.slug}`} className="mb-3 text-2xl font-medium tracking-tight">
            <Link href={diseaseHref(disease.slug)} className={textLink}>
              {disease.name}
            </Link>
          </h2>
          <ul className="grid max-w-2xl gap-6">
            {datasets.map((dataset) => (
              <li key={dataset.id}>
                <h3>
                  <Link
                    href={datasetHref(dataset)}
                    className={`${strongLink} inline-flex min-h-11 items-center text-lg`}
                  >
                    {dataset.label}
                  </Link>
                </h3>
                <p className="text-muted">{dataset.description}</p>
                <DatasetHeadline dataset={dataset} id={`figure-${dataset.id}`} />
                <ul className="mt-2 flex flex-wrap gap-x-4" aria-label={`Views of ${dataset.label}`}>
                  {dataset.views.map((view) => (
                    <li key={view}>
                      <Link
                        href={placeViewHref(dataset, view, place)}
                        // The visible text starts the name, so the two agree.
                        aria-label={`${VIEW_LABELS[view]}: ${dataset.label}`}
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
        </section>
      ))}
    </main>
  );
}
