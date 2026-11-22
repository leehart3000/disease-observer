import type { Metadata } from "next";
import { DiseaseCard, MapCard } from "@/components/DiseaseCard";
import { DISEASES, coverageSentence } from "@/lib/datasets/registry";
import { canonicalFor } from "@/lib/seo";

export const metadata: Metadata = { alternates: canonicalFor("/") };

/** The home page: one card for each disease in the registry, and one for the map. */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="max-w-2xl text-balance text-3xl font-medium tracking-tight sm:text-4xl">
        Maps and charts for infectious disease surveillance
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Disease Observer brings public figures on infectious diseases together
        in one place. {coverageSentence()}
      </p>
      <h2 className="mt-10 mb-4 text-2xl font-medium tracking-tight">Explore</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISEASES.map((disease) => (
          <DiseaseCard key={disease.slug} {...disease} headingLevel="h3" />
        ))}
        <MapCard headingLevel="h3" />
      </div>
    </main>
  );
}
