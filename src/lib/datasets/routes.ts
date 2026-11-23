/**
 * The site's page addresses, built from the registry. Every link to a
 * disease, dataset or view, and the sitemap, use these, so a URL is only
 * written in one place.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so
 * tests can import it too.
 */
import { allLocations } from "../locations.ts";
import { DATASETS, DISEASES } from "./registry.ts";
import type { DatasetDef, Place, View } from "./types.ts";

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

/**
 * The chart page of a dataset with the area `code` chosen on it
 * (`…/chart?areas=E06000001`), or `null` if the dataset's chart does not
 * compare areas (or has no chart page), so there is nothing to link to.
 */
export function chartAreaHref(
  dataset: Pick<DatasetDef, "diseaseSlug" | "slug" | "views" | "chart">,
  code: string,
): string | null {
  if (dataset.chart.mode !== "pick-areas" || !dataset.views.includes("chart")) return null;
  return `${viewHref(dataset, "chart")}?areas=${code}`;
}

/** The views a dataset has a page for, each with its address, in the order of its `views`. */
export function viewTabs(
  dataset: Pick<DatasetDef, "diseaseSlug" | "slug" | "views">,
): Array<{ view: View; href: string }> {
  return dataset.views.map((view) => ({ view, href: viewHref(dataset, view) }));
}

/**
 * The views that show a period (`?p=`), so a link to one of them keeps it.
 * A chart shows every week, so a link to it drops the period.
 */
export const PERIOD_VIEWS: readonly View[] = ["map", "table"];

/** The page that lists every map: `/maps`. */
export const MAPS_HREF = "/maps";

/** The page that lists every place: `/locations`. */
export const LOCATIONS_HREF = "/locations";

/** The page of a place: `/locations/england`. */
export function locationHref(slug: string): string {
  return `${LOCATIONS_HREF}/${slug}`;
}

/**
 * The address of a view of a dataset, for the page of a place. For the
 * dataset's whole place (England in the UKHSA datasets) it is the view
 * itself. For a place that is one of the dataset's areas (same code scheme, and
 * not the whole place) it carries `?areas=<code>`, which pins the area on the
 * map and the table and chooses it on the chart.
 */
export function placeViewHref(
  dataset: Pick<DatasetDef, "diseaseSlug" | "slug" | "place" | "map">,
  view: View,
  place: Pick<Place, "code" | "scheme">,
): string {
  const base = viewHref(dataset, view);
  const isArea = place.code !== dataset.place.code && place.scheme === dataset.map.areaScheme;
  return isArea ? `${base}?areas=${place.code}` : base;
}

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
    LOCATIONS_HREF,
    ...allLocations().map((place) => locationHref(place.slug)),
    ...DATASETS.flatMap((dataset) => [
      datasetHref(dataset),
      ...dataset.views.map((view) => viewHref(dataset, view)),
    ]),
    "/sources",
    "/about",
    "/privacy",
  ];
}
