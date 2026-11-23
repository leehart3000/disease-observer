/**
 * Decides, before any page is rendered, what to do with a request to one of
 * the addresses in `src/proxy.ts`'s matcher: carry on, answer 404, or
 * redirect. It is a proxy job because a Cache Components page cannot change
 * its status once its shell is sent, so a bad address must be caught first.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so
 * tests can import it too.
 */
import {
  DEFAULT_DATASET_ID,
  getDataset,
  getDatasetBySlug,
  getDisease,
  offersPeriod,
} from "./datasets/registry.ts";
import { viewHref } from "./datasets/routes.ts";
import { getLocation } from "./locations.ts";
import type { DatasetDef } from "./datasets/types.ts";

/** What to do with a request. */
export type RouteDecision =
  | { action: "continue" }
  | { action: "not-found" }
  | { action: "redirect"; to: string };

/** Decodes a path segment, leaving it as it is if it is not valid (such as `%E0%A4`). */
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Where the old map address `/map?d=<dataset>&p=<period>` now lives. An
 * unknown or missing dataset gives the default one, and a period is kept
 * only if the dataset offers it (and it is not the default `latest`).
 */
function oldMapRedirect(searchParams: URLSearchParams): string {
  const requested = searchParams.get("d");
  const dataset =
    (requested !== null ? getDataset(requested) : undefined) ??
    (getDataset(DEFAULT_DATASET_ID) as DatasetDef);
  const period = searchParams.get("p");
  const query =
    period !== null && period !== "latest" && offersPeriod(dataset, period)
      ? `?${new URLSearchParams({ p: period })}`
      : "";
  return `${viewHref(dataset, "map")}${query}`;
}

/**
 * Decides what to do with a request.
 *
 * - `/map` (the old address, with or without `?d=` and `?p=`) redirects to the
 *   dataset's map page.
 * - `/diseases/<disease>`, `/diseases/<disease>/<dataset>` and
 *   `/diseases/<disease>/<dataset>/<view>` continue only if each part is in
 *   the registry (and the view is one the dataset has a page for). Anything
 *   else is a 404. The sharing pictures, `/diseases/<disease>/opengraph-image`
 *   and `/diseases/<disease>/<dataset>/opengraph-image` (and `twitter-image`),
 *   continue if the disease or dataset is in the registry.
 * - `/locations/<place>` continues only for a place that some dataset
 *   covers. Anything else is a 404.
 * - Everything else continues.
 *
 * @param pathname - The request's path.
 * @param searchParams - The request's query string.
 */
export function decideRoute(pathname: string, searchParams: URLSearchParams): RouteDecision {
  if (pathname === "/map") return { action: "redirect", to: oldMapRedirect(searchParams) };
  if (pathname.startsWith("/locations/")) {
    const [slug, ...extra] = pathname.split("/").filter(Boolean).slice(1).map(safeDecode);
    // A place that has no data (an unknown slug, or a country no dataset covers) is a 404.
    return extra.length === 0 && slug && getLocation(slug)
      ? { action: "continue" }
      : { action: "not-found" };
  }
  if (!pathname.startsWith("/diseases/")) return { action: "continue" };

  const parts = pathname.split("/").filter(Boolean).slice(1).map(safeDecode);

  // The pictures for sharing a disease or a dataset (`opengraph-image` and
  // `twitter-image`) come after the disease or dataset in the address.
  const last = parts[parts.length - 1];
  if ((last === "opengraph-image" || last === "twitter-image") && parts.length <= 3) {
    const known =
      parts.length === 2
        ? getDisease(parts[0]) !== undefined
        : parts.length === 3 && getDatasetBySlug(parts[0], parts[1]) !== undefined;
    return known ? { action: "continue" } : { action: "not-found" };
  }

  const [diseaseSlug, datasetSlug, view, ...extra] = parts;
  if (extra.length > 0 || !diseaseSlug || !getDisease(diseaseSlug)) return { action: "not-found" };
  if (datasetSlug === undefined) return { action: "continue" };

  const dataset = getDatasetBySlug(diseaseSlug, datasetSlug);
  if (!dataset) return { action: "not-found" };
  if (view === undefined) return { action: "continue" };
  return (dataset.views as readonly string[]).includes(view)
    ? { action: "continue" }
    : { action: "not-found" };
}
