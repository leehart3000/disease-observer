/**
 * The site's page addresses, built from the registry. Every link to a
 * disease, dataset or view, and the sitemap, use these, so a URL is only
 * written in one place.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so
 * tests can import it too.
 */
import { DATASETS, DISEASES } from "./registry.ts";
import type { DatasetDef, View } from "./types.ts";

/** The names of the views, as they are written in links, tabs and breadcrumbs. */
export const VIEW_LABELS: Record<View, string> = {
  map: "Map",
  chart: "Chart",
  table: "Table",
};

/** The page of a disease: `/diseases/covid-19`. */
export function diseaseHref(diseaseSlug: string): string {
  return `/diseases/${diseaseSlug}`;
}

/** The page of a dataset: `/diseases/covid-19/rate-by-local-authority`. */
export function datasetHref(dataset: Pick<DatasetDef, "diseaseSlug" | "slug">): string {
  return `${diseaseHref(dataset.diseaseSlug)}/${dataset.slug}`;
}

/** The page of one view of a dataset: `/diseases/covid-19/rate-by-local-authority/map`. */
export function viewHref(dataset: Pick<DatasetDef, "diseaseSlug" | "slug">, view: View): string {
  return `${datasetHref(dataset)}/${view}`;
}

/** The views a dataset has a page for, each with its address, in the order of its `views`. */
export function viewTabs(
  dataset: Pick<DatasetDef, "diseaseSlug" | "slug" | "views">,
): Array<{ view: View; href: string }> {
  return dataset.views.map((view) => ({ view, href: viewHref(dataset, view) }));
}

/** The page that lists every map: `/maps`. */
export const MAPS_HREF = "/maps";

/**
 * Every page the site has, as paths, for the sitemap. Generated from the
 * registry, so a new disease, dataset or view is listed without more work:
 * a dataset's pages are its own page and one page for each view in its
 * `views`.
 */
export function sitePaths(): string[] {
  return [
    "/",
    "/diseases",
    ...DISEASES.map((disease) => diseaseHref(disease.slug)),
    MAPS_HREF,
    ...DATASETS.flatMap((dataset) => [
      datasetHref(dataset),
      ...dataset.views.map((view) => viewHref(dataset, view)),
    ]),
    "/sources",
    "/about",
  ];
}
