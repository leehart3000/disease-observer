import type { Metadata } from "next";
import { SourcesSection } from "@/components/SourcesSection";
import { BASE_MAP_CREDIT } from "@/lib/credits";
import { usedSourceSlugs } from "@/lib/datasets/registry";
import { canonicalFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sources and licences",
  description:
    "Where Disease Observer's data comes from, and the licences that apply.",
  alternates: canonicalFor("/sources"),
};

/**
 * Where the data comes from. The sources are the ones that a dataset in the
 * registry uses, so a source appears here once the site uses it. The base
 * map's credit is added after them.
 */
export default function SourcesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-8 sm:px-6 sm:pt-5 sm:pb-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Sources and licences</h1>
      <p className="mt-3 mb-8 max-w-2xl text-lg text-muted">
        Everything on this site comes from open data. These are the sources, with the
        credit each one asks for and the licence that applies.
      </p>
      <div className="max-w-2xl text-muted">
        <SourcesSection slugs={usedSourceSlugs()} extra={[BASE_MAP_CREDIT]} />
      </div>
    </main>
  );
}
