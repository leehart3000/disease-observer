import type { Metadata } from "next";
import { Suspense } from "react";
import { coverageSentence } from "@/lib/datasets/registry";
import { canonicalFor } from "@/lib/seo";
import { MapSection } from "./MapSection";

export const metadata: Metadata = {
  title: "Map",
  description: `Maps of infectious disease cases, area by area. ${coverageSentence()}`,
  // /map?d=… are views of the same page.
  alternates: canonicalFor("/map"),
};

/**
 * The map page. The heading is static; the map and table stream in. The
 * dataset is chosen in the URL: `/map?d=measles-cases`.
 */
export default function MapPage({ searchParams }: PageProps<"/map">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Map</h1>
      <p className="mt-3 mb-6 max-w-2xl text-lg text-muted">
        Choose a dataset to see where cases are being reported. {coverageSentence()}
      </p>
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
        <MapSection searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
