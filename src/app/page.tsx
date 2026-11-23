import type { Metadata } from "next";
import { DiseaseCard, LocationsCard, MapCard } from "@/components/DiseaseCard";
import { CoverageList } from "@/components/CoverageList";
import { DISEASES } from "@/lib/datasets/registry";
import { canonicalFor, socialMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonicalFor("/"),
  ...socialMetadata(
    "Disease Observer",
    "Maps and charts for infectious disease surveillance.",
    "/",
  ),
};

/** The home page: one card for each disease in the registry, and one each for the maps and the locations. */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
      <h1 className="max-w-2xl text-balance text-3xl font-medium tracking-tight sm:text-4xl">
        Maps and charts for infectious disease surveillance
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Disease Observer brings published data on infectious diseases together
        in one place.
      </p>
      <div className="mt-4 max-w-xl text-muted">
        <CoverageList />
      </div>
      <h2 className="mt-10 mb-4 text-2xl font-medium tracking-tight">Diseases</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISEASES.map((disease) => (
          <DiseaseCard key={disease.slug} {...disease} headingLevel="h3" />
        ))}
      </div>
      <h2 className="mt-10 mb-4 text-2xl font-medium tracking-tight">Explore</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MapCard headingLevel="h3" />
        <LocationsCard headingLevel="h3" />
      </div>
    </main>
  );
}
