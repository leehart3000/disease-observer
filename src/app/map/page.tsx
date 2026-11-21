import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { MapSection } from "./MapSection";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Latest COVID-19 case rates by local authority and measles cases by region in England, from UKHSA.",
};

/** The map page. The header and heading are static; the map and table stream in. */
export default function MapPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Map</h1>
        <p className="mt-3 mb-6 max-w-2xl text-lg text-muted">
          The latest COVID-19 case rates for local authorities in England, and
          measles cases by region.
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
          <MapSection />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
