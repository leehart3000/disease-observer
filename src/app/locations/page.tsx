import type { Metadata } from "next";
import { Card } from "@/components/DiseaseCard";
import { diseaseInSentence, joinList } from "@/lib/datasets/registry";
import { LOCATIONS_HREF, locationHref } from "@/lib/datasets/routes";
import { allLocations, diseasesForLocation } from "@/lib/locations";
import { canonicalFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Locations",
  description: "The places that Disease Observer has infectious disease figures for.",
  alternates: canonicalFor(LOCATIONS_HREF),
};

/**
 * Every place the site has figures for, one card each, with the diseases it
 * has. It is generated from the registry (a place appears when a dataset
 * covers it), so it does not need the database.
 */
export default function LocationsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Locations</h1>
      <p className="mt-3 mb-8 max-w-2xl text-lg text-muted">
        A place appears here once the site has data for it. Choose one to see every disease with
        figures for it.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allLocations().map((place) => (
          <Card key={place.slug} href={locationHref(place.slug)} title={place.name} headingLevel="h2">
            {`Figures for ${joinList(
              diseasesForLocation(place.slug).map(({ disease }) => diseaseInSentence(disease.name)),
            )}.`}
          </Card>
        ))}
      </div>
    </main>
  );
}
