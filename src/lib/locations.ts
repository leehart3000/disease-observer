/**
 * The places that the site has figures for, and the datasets that cover each.
 * A place has its own page under `/locations`.
 *
 * A place is England (the ONS datasets) or a country (the Natural Earth
 * countries, with ISO 3166-1 alpha-3 codes). It is listed only if some
 * dataset in the registry names it in its `locations`, so the list, the pages
 * and the sitemap come from the registry and need no database.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so tests
 * can import it too.
 */
import countries from "../../data/natural-earth/countries.json";
import { DATASETS, DISEASES } from "./datasets/registry.ts";
import type { DatasetDef, DiseaseDef, Place } from "./datasets/types.ts";

/** The code scheme of a country's code in the `areas` table. */
const COUNTRY_CODE_SCHEME = "iso3166-1-alpha3";

/** The registry's datasets, typed as the general `DatasetDef` (not the exact literal types). */
const DATASET_LIST: readonly DatasetDef[] = DATASETS;

/** The code, name and slug of every country, from `data/natural-earth/countries.json`. */
const countryList: ReadonlyArray<{ code: string; name: string; slug: string }> = countries;

/**
 * Finds a place by its slug among the places the registry's datasets know
 * (their own `place`), then among the countries. England is the place of the
 * UKHSA datasets.
 *
 * @returns `undefined` if no such place exists (whether or not it has data).
 */
function findPlace(slug: string): Place | undefined {
  for (const dataset of DATASET_LIST) {
    if (dataset.place.slug === slug) return dataset.place;
  }
  const country = countryList.find((entry) => entry.slug === slug);
  return country
    ? { name: country.name, slug: country.slug, code: country.code, scheme: COUNTRY_CODE_SCHEME }
    : undefined;
}

/**
 * Every place that some dataset covers, by name. A dataset's `locations` that
 * name no known place are left out (a test checks there are none).
 */
export function allLocations(): Place[] {
  const slugs = new Set(DATASET_LIST.flatMap((dataset) => dataset.locations));
  return [...slugs]
    .flatMap((slug) => {
      const place = findPlace(slug);
      return place ? [place] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

/** Finds a place that has data, by slug, or `undefined` if there is none (an unknown slug, or a country with no data). */
export function getLocation(slug: string): Place | undefined {
  return allLocations().find((place) => place.slug === slug);
}

/** The datasets that have figures for a place, in the registry's order. */
export function datasetsForLocation(slug: string): DatasetDef[] {
  return DATASET_LIST.filter((dataset) => dataset.locations.includes(slug));
}

/**
 * The diseases that have data for a place, in the registry's order, each with
 * its datasets for that place.
 */
export function diseasesForLocation(slug: string): Array<{ disease: DiseaseDef; datasets: DatasetDef[] }> {
  const datasets = datasetsForLocation(slug);
  return DISEASES.map((disease) => ({
    disease: disease as DiseaseDef,
    datasets: datasets.filter((dataset) => dataset.diseaseSlug === disease.slug),
  })).filter((group) => group.datasets.length > 0);
}

/** How a place reads in a sentence: the dataset's phrase ("the United States") or just its name. */
export function placePhrase(slug: string): string {
  for (const dataset of DATASET_LIST) {
    if (dataset.place.slug === slug) return dataset.place.phrase ?? dataset.place.name;
  }
  return findPlace(slug)?.name ?? slug;
}
