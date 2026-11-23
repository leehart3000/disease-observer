import type { Metadata } from "next";
import { DiseaseCard } from "@/components/DiseaseCard";
import { DISEASES } from "@/lib/datasets/registry";
import { canonicalFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Diseases",
  description: "The infectious diseases covered by Disease Observer.",
  alternates: canonicalFor("/diseases"),
};

/** The diseases the site covers, one card for each disease in the registry. */
export default function DiseasesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-8 sm:px-6 sm:pt-5 sm:pb-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Diseases</h1>
      <p className="mt-3 mb-8 max-w-2xl text-lg text-muted">
        A disease appears here once the site has data for it.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DISEASES.map((disease) => (
          <DiseaseCard
            key={disease.slug}
            slug={disease.slug}
            name={disease.name}
            summary={disease.summary}
            headingLevel="h2"
          />
        ))}
      </div>
    </main>
  );
}
