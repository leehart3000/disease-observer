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
  },
  {
    slug: "measles",
    name: "Measles",
    summary: "Confirmed measles cases in England, by UKHSA region and week.",
    about: [
      "Measles is a highly infectious viral illness. Two doses of the MMR vaccine give lasting protection, and outbreaks can follow when vaccination rates fall.",
      "The map shows the number of confirmed cases in each UKHSA region for the latest complete week, by the week that symptoms began. Recent weeks are provisional because cases are still being reported.",
    ],
  },
] as const satisfies readonly DiseaseDef[];

export const DATASETS = [
  {
    id: "covid-19-rate",
    diseaseSlug: "covid-19",
    label: "COVID-19 rate by local authority",
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
    map: {
      areaLevel: "lower_tier_local_authority",
      boundaryUrl: "/boundaries/lad-dec-2022.json",
      areaNoun: "local authorities",
    },
    scale: { classes: 6, rounding: "2sf", zeroClass: false },
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
  {
    id: "measles-cases",
    diseaseSlug: "measles",
    label: "Measles cases by region",
    title: "Measles cases, by UKHSA region",
    metric: "cases",
    valueKind: "count",
    unit: { label: "cases", one: "case", many: "cases" },
    periodStyle: "onset-week",
    periodType: "week",
    periods: ["latest"],
    completePeriodsOnly: true,
    columnHeading: { latest: "Cases (week)" },
    map: {
      areaLevel: "region",
      boundaryUrl: "/boundaries/rgn-dec-2022.json",
      areaNoun: "regions",
    },
    scale: { classes: 6, rounding: "integer", zeroClass: true },
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

/** True if `period` is one of the choices that a dataset offers. */
export function offersPeriod(dataset: DatasetDef, period: string): period is PeriodChoice {
  return (dataset.periods as readonly string[]).includes(period);
}
