import type { Metadata } from "next";
import Link from "next/link";
import { strongLink } from "@/components/link-styles";
import { DISEASES, datasetsForDisease } from "@/lib/datasets/registry";
import { MAPS_HREF, viewHref } from "@/lib/datasets/routes";
import { canonicalFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Maps",
  description: "Maps of infectious disease cases, area by area, for every disease on the site.",
  alternates: canonicalFor(MAPS_HREF),
};

/**
 * Every map on the site, grouped by disease. It is generated from the
 * registry, so a dataset with a map page is listed here without more work,
 * and it does not need the database.
 */
export default function MapsPage() {
  const groups = DISEASES.map((disease) => ({
    disease,
    datasets: datasetsForDisease(disease.slug).filter((dataset) => dataset.views.includes("map")),
  })).filter((group) => group.datasets.length > 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-8 sm:px-6 sm:pt-5 sm:pb-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Maps</h1>
      <p className="mt-3 mb-8 max-w-2xl text-lg text-muted">
        Choose a map to see where cases are being reported, area by area.
      </p>
      <div className="grid max-w-2xl gap-8">
        {groups.map(({ disease, datasets }) => (
          <section key={disease.slug} aria-labelledby={`maps-${disease.slug}`}>
            <h2 id={`maps-${disease.slug}`} className="text-2xl font-medium tracking-tight">
              {disease.name}
            </h2>
            <ul className="mt-3 grid gap-4">
              {datasets.map((dataset) => (
                <li key={dataset.id}>
                  <Link
                    href={viewHref(dataset, "map")}
                    prefetch
                    className={`${strongLink} inline-flex min-h-11 items-center text-lg`}
                  >
                    {dataset.label}
                  </Link>
                  <p className="text-muted">{dataset.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
