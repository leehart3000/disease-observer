/**
 * The registry of diseases and datasets. The map, the dataset picker and
 * the credits are driven by it, so adding a dataset is mostly adding an
 * entry to `DATASETS`.
 *
 * A disease appears here only when the site has data for it.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so the
 * ETL can import this file too.
 */
import type { DatasetDef, DiseaseDef, PeriodChoice } from "./types.ts";

export const DISEASES = [
  {
    slug: "covid-19",
    name: "COVID-19",
    summary: "Reported COVID-19 case rates for every local authority in England.",
    about: [
      "COVID-19 is an infectious disease caused by the SARS-CoV-2 virus. It spreads mainly through the air and can cause illness ranging from a mild cough to serious breathing problems.",
      "The map shows the rate of newly reported cases in the latest 7 days for each local authority, per 100,000 people. Rates allow areas of different sizes to be compared.",
    ],
    headline: { datasetId: "covid-19-rate" },
    chart: { since: "2023-01-01" },
  },
  {
    slug: "measles",
    name: "Measles",
    summary: "Confirmed measles cases in England, by UKHSA region and week.",
    about: [
      "Measles is a highly infectious viral illness. Two doses of the MMR vaccine give lasting protection, and outbreaks can follow when vaccination rates fall.",
      "The map shows the number of confirmed cases in each UKHSA region, by the week that symptoms began, for the latest complete week or added up over the last 12 weeks or the year so far. Recent weeks are provisional because cases are still being reported.",
    ],
    headline: { datasetId: "measles-cases" },
    chart: { since: "2023-01-01" },
  },
] as const satisfies readonly DiseaseDef[];

export const DATASETS = [
  {
    id: "covid-19-rate",
    diseaseSlug: "covid-19",
    slug: "rate-by-local-authority",
    name: "Rate by local authority",
    views: ["map", "table"],
    label: "COVID-19 rate by local authority",
    description:
      "The rate of newly reported cases in the latest 7 days for each local authority, per 100,000 people.",
    howToRead:
      "Each value is the number of newly reported cases in the 7 days ending on the date shown, for every 100,000 people who live in the local authority. The most recent days are provisional, because cases are still being reported.",
    title: "COVID-19 cases per 100,000 people, by local authority",
    // UKHSA documents this as the rate of reported new cases in the 7 days
    // ending on the date shown.
    metric: "rate_per_100k",
    valueKind: "rate",
    unit: { label: "per 100,000" },
    periodStyle: "trailing-week",
    periodType: "week",
    periods: ["latest"],
    completePeriodsOnly: false,
    columnHeading: { latest: "Cases per 100,000 (7 days)" },
    periodNote:
      "COVID-19 rates are shown for the latest 7 days only, because rates can’t be added together.",
    map: {
      areaLevel: "lower_tier_local_authority",
      boundaryUrl: "/boundaries/lad-dec-2022.json",
      areaNoun: "local authorities",
    },
    scale: { classes: 6, rounding: "2sf", zeroClass: false },
    place: "England",
    publisher: "UK Health Security Agency",
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
  {
    id: "measles-cases",
    diseaseSlug: "measles",
    slug: "cases-by-region",
    name: "Cases by region",
    views: ["map", "table"],
    label: "Measles cases by region",
    description:
      "The number of confirmed cases in each UKHSA region, by the week that symptoms began: for the latest complete week, the last 12 weeks or the year so far.",
    howToRead:
      "Each value is the number of confirmed cases whose symptoms began in the period shown. Weeks run from Monday to Sunday, and only complete weeks are counted. You can show the latest week, the total for the last 12 weeks, or the total for the year to date (the weeks that start in the same year as the latest week). A total is provisional if any week in it is, because cases are still being reported. Where a region has no figure for a week, the total is of the weeks it has, and the page says how many.",
    title: "Measles cases, by UKHSA region",
    metric: "cases",
    valueKind: "count",
    unit: { label: "cases", one: "case", many: "cases" },
    periodStyle: "onset-week",
    periodType: "week",
    periods: ["latest", "12w", "ytd"],
    completePeriodsOnly: true,
    columnHeading: {
      latest: "Cases (week)",
      "12w": "Cases (12 weeks)",
      ytd: "Cases (year to date)",
    },
    map: {
      areaLevel: "region",
      boundaryUrl: "/boundaries/rgn-dec-2022.json",
      areaNoun: "regions",
    },
    scale: { classes: 6, rounding: "integer", zeroClass: true },
    place: "England",
    publisher: "UK Health Security Agency",
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
] as const satisfies readonly DatasetDef[];

/** The identifier of a registered dataset. A typo in one is a compile error. */
export type DatasetId = (typeof DATASETS)[number]["id"];

/** The slug of a registered disease. */
export type DiseaseSlug = (typeof DISEASES)[number]["slug"];

/** The dataset that `/map` shows when none is chosen. */
export const DEFAULT_DATASET_ID: DatasetId = DATASETS[0].id;

const datasetList: readonly DatasetDef[] = DATASETS;
const diseaseList: readonly DiseaseDef[] = DISEASES;

/** Finds a dataset by id, or `undefined` if there is none. */
export function getDataset(id: string): DatasetDef | undefined {
  return datasetList.find((dataset) => dataset.id === id);
}

/** Finds a disease by slug, or `undefined` if there is none. */
export function getDisease(slug: string): DiseaseDef | undefined {
  return diseaseList.find((disease) => disease.slug === slug);
}

/** Finds a disease's dataset by its URL slug, or `undefined` if there is none. */
export function getDatasetBySlug(diseaseSlug: string, slug: string): DatasetDef | undefined {
  return datasetList.find(
    (dataset) => dataset.diseaseSlug === diseaseSlug && dataset.slug === slug,
  );
}

/** The datasets of one disease, in registry order. */
export function datasetsForDisease(slug: string): DatasetDef[] {
  return datasetList.filter((dataset) => dataset.diseaseSlug === slug);
}

/**
 * The slugs of the `sources` rows that a disease's datasets use, without
 * repeats, in the order the datasets list them.
 */
export function sourceSlugsForDisease(slug: string): string[] {
  return [...new Set(datasetsForDisease(slug).flatMap((dataset) => dataset.sourceSlugs))];
}

/**
 * The slugs of every `sources` row that some dataset uses. A source that no
 * dataset uses (such as WHO FluNet, for now) is left out.
 */
export function usedSourceSlugs(): string[] {
  return [...new Set(datasetList.flatMap((dataset) => dataset.sourceSlugs))];
}

/** Joins items as "a", "a and b" or "a, b and c". */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * A sentence on what the site covers now, built from the registry so that it
 * updates itself when a dataset is added. Datasets with the same place and
 * publisher are grouped, for example "Currently covers COVID-19 and measles
 * in England, from the UK Health Security Agency."
 */
export function coverageSentence(): string {
  const groups = new Map<string, { place: string; publisher: string; diseases: string[] }>();
  for (const dataset of datasetList) {
    const key = `${dataset.place}|${dataset.publisher}`;
    const group = groups.get(key) ?? {
      place: dataset.place,
      publisher: dataset.publisher,
      diseases: [],
    };
    const name = getDisease(dataset.diseaseSlug)?.name;
    // Mid-sentence, "Measles" becomes "measles", but "COVID-19" stays as it is.
    const inSentence = name && /[A-Z]/.test(name.slice(1)) ? name : name?.toLowerCase();
    if (inSentence && !group.diseases.includes(inSentence)) group.diseases.push(inSentence);
    groups.set(key, group);
  }
  const parts = [...groups.values()].map(
    ({ diseases, place, publisher }) => `${joinList(diseases)} in ${place}, from the ${publisher}`,
  );
  return `Currently covers ${parts.join("; ")}.`;
}

/** True if `period` is one of the choices that a dataset offers. */
export function offersPeriod(dataset: DatasetDef, period: string): period is PeriodChoice {
  return (dataset.periods as readonly string[]).includes(period);
}
