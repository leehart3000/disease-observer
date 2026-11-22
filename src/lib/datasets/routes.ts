/**
 * The site's page addresses, built from the registry. Every link to a
 * disease, dataset or view, and the sitemap, use these, so a URL is only
 * written in one place.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so
 * tests can import it too.
 */
import { DISEASES } from "./registry.ts";
import type { DatasetDef, View } from "./types.ts";

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

/**
 * Every page the site has, as paths, for the sitemap. Generated from the
 * registry, so a new disease is listed without more work. Dataset pages
 * will be added here when they exist (a dataset's `views` says which); for
 * now the map is the single `/map` page.
 */
export function sitePaths(): string[] {
  return [
    "/",
    "/diseases",
    ...DISEASES.map((disease) => diseaseHref(disease.slug)),
    "/map",
    "/sources",
    "/about",
  ];
}
