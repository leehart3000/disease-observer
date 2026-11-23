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
import type { DatasetDef, DiseaseDef, LngLatBounds, PeriodChoice, Place } from "./types.ts";

/** The areas that the disease charts for England draw with England: the UKHSA regions. */
const ENGLAND_CHART_AREAS = { level: "region", noun: "regions", label: "UKHSA regions" } as const;

export const DISEASES = [
  {
    slug: "covid-19",
    name: "COVID-19",
    summary:
      "An infectious disease caused by the SARS-CoV-2 virus, with a range of symptoms from a mild cough to serious breathing problems.",
    about: [
      "COVID-19 is an infectious disease caused by the SARS-CoV-2 virus. It spreads mainly through the air and can cause illness ranging from a mild cough to serious breathing problems.",
    ],
    headline: { datasetId: "covid-19-rate" },
    chart: { since: "2023-01-01", areas: ENGLAND_CHART_AREAS },
  },
  {
    slug: "measles",
    name: "Measles",
    summary:
      "A highly infectious viral illness that two doses of the MMR vaccine protect against.",
    about: [
      "Measles is a highly infectious viral illness. Two doses of the MMR vaccine give lasting protection, and outbreaks can follow when vaccination rates fall.",
    ],
    headline: { datasetId: "measles-cases" },
    chart: { since: "2023-01-01", areas: ENGLAND_CHART_AREAS },
  },
  {
    slug: "influenza",
    name: "Influenza",
    summary:
      "A contagious respiratory illness, often called flu, and a common cause of hospital admission in the winter months.",
    about: [
      "Influenza, or flu, is a contagious respiratory illness caused by influenza viruses. It spreads mainly through droplets and can cause mild or severe illness. It is a common cause of hospital admission in the winter months.",
    ],
    headline: { datasetId: "influenza-hospital-admissions" },
    chart: { since: "2023-01-01", areas: null },
  },
  {
    slug: "rsv",
    name: "RSV",
    summary:
      "A common respiratory virus that usually causes mild, cold-like illness but can be serious in babies, young children and older adults.",
    about: [
      "Respiratory syncytial virus (RSV) is a common respiratory virus. It usually causes mild, cold-like illness, but it can be serious in babies, young children and older adults.",
    ],
    headline: { datasetId: "rsv-hospital-admissions" },
    chart: { since: "2023-01-01", areas: null },
  },
] as const satisfies readonly DiseaseDef[];

/**
 * England as a place: the row of the `areas` table that holds the national
 * figures of the UKHSA datasets (an ONS code).
 */
const ENGLAND = {
  name: "England",
  slug: "england",
  code: "E92000001",
  scheme: "ons",
} as const satisfies Place;

/**
 * The United States as a place: its national figures are the `USA` row of the
 * `areas` table (an ISO 3166-1 code), while its states are ISO 3166-2 codes.
 */
const UNITED_STATES = {
  name: "United States",
  phrase: "the United States",
  slug: "united-states",
  code: "USA",
  scheme: "iso3166-1-alpha3",
} as const satisfies Place;

/** The contiguous United States, with some room around it. Alaska and Hawaii have buttons (`US_VIEWS`). */
const US_BOUNDS = [
  [-128, 22],
  [-64, 51],
] as const satisfies LngLatBounds;

/** Where the "Show Alaska" and "Show Hawaii" buttons take a US map. */
const US_VIEWS = [
  {
    label: "Alaska",
    bounds: [
      [-171, 51],
      [-129, 72],
    ],
  },
  {
    label: "Hawaii",
    bounds: [
      [-161, 18.5],
      [-154, 22.5],
    ],
  },
] as const satisfies NonNullable<DatasetDef["map"]["views"]>;

/** The farthest a US map can be moved: far enough to reach Alaska and Hawaii. */
const US_MAX_BOUNDS = [
  [-180, 15],
  [-55, 75],
] as const satisfies LngLatBounds;

/**
 * What the three hospital admission datasets have in common. They come from
 * one source (CDC's National Healthcare Safety Network, NHSN), one row for each
 * jurisdiction and week, with one rate per disease. The rates are as the
 * source publishes them (new admissions of patients with a confirmed
 * infection in the Sunday to Saturday week, per 100,000 people).
 */
const NHSN_DATASET = {
  slug: "hospital-admissions-by-state",
  name: "Admissions by state",
  views: ["map", "chart", "table"],
  metric: "admissions_per_100k",
  valueKind: "rate",
  // The rates are small (0.06 in a quiet week), so one decimal place would hide them.
  decimals: 2,
  measure: "hospital admissions per 100,000",
  unit: { label: "per 100,000" },
  periodStyle: "trailing-week",
  periodType: "week",
  periods: ["latest"],
  completePeriodsOnly: false,
  columnHeading: { latest: "Admissions per 100,000 (week)" },
  periodNote:
    "Admission rates are shown for the latest week only, because rates can’t be added together.",
  chart: { mode: "pick-areas" },
  map: {
    areaLevel: "region",
    boundaryUrl: "/boundaries/us-states-50m.json",
    bounds: US_BOUNDS,
    maxBounds: US_MAX_BOUNDS,
    // The key under the map, so it does not cover California, Arizona and Texas.
    legendBelow: true,
    views: US_VIEWS,
    openingView: "contiguous states",
    boundaryNotice: "natural-earth",
    areaScheme: "iso3166-2",
    areaNoun: "states",
    areaNounOne: "state",
  },
  scale: { classes: 6, rounding: "2sf", zeroClass: false },
  locations: ["united-states"],
  place: UNITED_STATES,
  publisher: "CDC National Healthcare Safety Network (NHSN)",
  sourceSlugs: ["cdc-nhsn", "natural-earth"],
} as const;

/** The caveats that apply to all three hospital admission datasets. */
const NHSN_CAVEATS = [
  "Hospitals report their admissions each week. Reporting was required until 30 April 2024, voluntary from 1 May to 31 October 2024, and required again from 1 November 2024, so how many hospitals report changes over time and between states.",
  "Not every hospital reports every week, so a state’s rate covers only the hospitals that reported.",
  "We mark the latest week as provisional, because hospitals can report late and the figures can change. The source does not say so itself.",
  "A state with few hospitals can change a lot from one week to the next.",
] as const;

/** England, with some room around it. */
const ENGLAND_BOUNDS = [
  [-6.2, 49.8],
  [2.1, 55.9],
] as const satisfies LngLatBounds;

/** The farthest an England map can be moved. */
const ENGLAND_MAX_BOUNDS = [
  [-10, 48],
  [5, 59],
] as const satisfies LngLatBounds;

/**
 * The datasets as written, without their place in their names. `DATASETS`
 * adds it (see `withPlace`), so a place is written once, in `place`.
 */
const RAW_DATASETS = [
  {
    id: "covid-19-rate",
    diseaseSlug: "covid-19",
    slug: "rate-by-local-authority",
    name: "Rate by local authority",
    views: ["map", "chart", "table"],
    label: "COVID-19 rate by local authority",
    description:
      "The rate of newly reported cases in the latest 7 days for each local authority in {place}, per 100,000 people.",
    howToRead:
      "Each value is the number of newly reported cases in the 7 days ending on the date shown, for every 100,000 people who live in the local authority. The most recent days are provisional, because cases are still being reported.",
    title: "COVID-19 cases per 100,000 people by local authority",
    mapExplanation:
      "The map shows the rate of newly reported cases in the latest 7 days for each local authority in {place}, per 100,000 people. Rates allow areas of different sizes to be compared.",
    // UKHSA documents this as the rate of reported new cases in the 7 days
    // ending on the date shown.
    metric: "rate_per_100k",
    valueKind: "rate",
    measure: "cases per 100,000",
    unit: { label: "per 100,000" },
    periodStyle: "trailing-week",
    periodType: "week",
    periods: ["latest"],
    completePeriodsOnly: false,
    columnHeading: { latest: "Cases per 100,000 (7 days)" },
    periodNote:
      "COVID-19 rates are shown for the latest 7 days only, because rates can’t be added together.",
    chart: { mode: "pick-areas" },
    map: {
      areaLevel: "lower_tier_local_authority",
      boundaryUrl: "/boundaries/lad-dec-2022.json",
      bounds: ENGLAND_BOUNDS,
      maxBounds: ENGLAND_MAX_BOUNDS,
      areaScheme: "ons",
      areaNoun: "local authorities",
      areaNounOne: "local authority",
    },
    scale: { classes: 6, rounding: "2sf", zeroClass: false },
    locations: ["england"],
    place: ENGLAND,
    publisher: "UK Health Security Agency",
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
  {
    id: "measles-cases",
    diseaseSlug: "measles",
    slug: "cases-by-region",
    name: "Cases by region",
    views: ["map", "chart", "table"],
    label: "Measles cases by region",
    description:
      "The number of confirmed cases in each region of {place} used by the UK Health Security Agency (UKHSA), by the week that symptoms began: for the latest complete week, the last 12 weeks or the year so far.",
    howToRead:
      "Each value is the number of confirmed cases whose symptoms began in the period shown. Weeks run from Monday to Sunday, and only complete weeks are counted. You can show the latest week, the total for the last 12 weeks, or the total for the year to date (the weeks that start in the same year as the latest week). A total is provisional if any week in it is, because cases are still being reported. Where a region has no figure for a week, the total is of the weeks it has, and the page says how many.",
    title: "Measles cases by UKHSA region",
    mapExplanation:
      "The map shows the number of confirmed cases in each UKHSA region of {place}, by the week that symptoms began, for the latest complete week or added up over the last 12 weeks or the year so far. Recent weeks are provisional because cases are still being reported.",
    metric: "cases",
    valueKind: "count",
    measure: "confirmed cases",
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
    chart: { mode: "all-areas" },
    map: {
      areaLevel: "region",
      boundaryUrl: "/boundaries/rgn-dec-2022.json",
      bounds: ENGLAND_BOUNDS,
      maxBounds: ENGLAND_MAX_BOUNDS,
      areaScheme: "ons",
      areaNoun: "regions",
      areaNounOne: "region",
    },
    scale: { classes: 6, rounding: "integer", zeroClass: true },
    locations: ["england"],
    place: ENGLAND,
    publisher: "UK Health Security Agency",
    sourceSlugs: ["ukhsa", "ons-geography"],
  },
  {
    ...NHSN_DATASET,
    id: "influenza-hospital-admissions",
    diseaseSlug: "influenza",
    label: "Influenza hospital admissions by state",
    description:
      "New hospital admissions of patients with confirmed influenza in the latest week, for each state in {place}, per 100,000 people.",
    howToRead:
      "Each value is the number of new hospital admissions of patients with confirmed influenza in the week shown (Sunday to Saturday), for every 100,000 people who live in the state. The rate is as published: it is not calculated here. The latest week is provisional, because hospitals can still report late.",
    title: "Influenza hospital admissions per 100,000 people by state",
    mapExplanation:
      "The map shows the number of new hospital admissions of patients with confirmed influenza in the latest week for each state in {place}, per 100,000 people. Rates allow states of different sizes to be compared. The latest week is provisional because hospitals can still report late.",
    caveats: NHSN_CAVEATS,
  },
  {
    ...NHSN_DATASET,
    id: "rsv-hospital-admissions",
    diseaseSlug: "rsv",
    label: "RSV hospital admissions by state",
    description:
      "New hospital admissions of patients with confirmed respiratory syncytial virus (RSV) in the latest week, for each state in {place}, per 100,000 people.",
    howToRead:
      "Each value is the number of new hospital admissions of patients with confirmed RSV in the week shown (Sunday to Saturday), for every 100,000 people who live in the state. The rate is as published: it is not calculated here. The latest week is provisional, because hospitals can still report late.",
    title: "RSV hospital admissions per 100,000 people by state",
    mapExplanation:
      "The map shows the number of new hospital admissions of patients with confirmed RSV in the latest week for each state in {place}, per 100,000 people. Rates allow states of different sizes to be compared. The latest week is provisional because hospitals can still report late.",
    caveats: [
      ...NHSN_CAVEATS,
      "RSV was reported voluntarily until 1 November 2024, so figures before then (the series starts in October 2023) cover only the hospitals that chose to report.",
    ],
  },
  {
    ...NHSN_DATASET,
    id: "covid-19-hospital-admissions-us",
    diseaseSlug: "covid-19",
    label: "COVID-19 hospital admissions by state",
    description:
      "New hospital admissions of patients with confirmed COVID-19 in the latest week, for each state in {place}, per 100,000 people.",
    howToRead:
      "Each value is the number of new hospital admissions of patients with confirmed COVID-19 in the week shown (Sunday to Saturday), for every 100,000 people who live in the state. The rate is as published: it is not calculated here. The latest week is provisional, because hospitals can still report late.",
    title: "COVID-19 hospital admissions per 100,000 people by state",
    mapExplanation:
      "The map shows the number of new hospital admissions of patients with confirmed COVID-19 in the latest week for each state in {place}, per 100,000 people. Rates allow states of different sizes to be compared. The latest week is provisional because hospitals can still report late.",
    caveats: NHSN_CAVEATS,
  },
] as const satisfies readonly DatasetDef[];

/**
 * Puts a dataset's place in its words, from its `place`, so that a dataset
 * always says where its figures are from (England's datasets once didn't,
 * when the wording was made global):
 *
 * - `name`, `label` and `title` end with the place's name:
 *   "COVID-19 rate by local authority, England".
 * - `{place}` in `description`, `mapExplanation` and `howToRead` becomes the
 *   place as it reads in a sentence: "England", "the United States".
 */
function withPlace<T extends DatasetDef>(dataset: T): DatasetDef {
  const { place } = dataset;
  const inSentence = (text: string) => text.replaceAll("{place}", place.phrase ?? place.name);
  const named = (text: string) => `${text}, ${place.name}`;
  return {
    ...dataset,
    name: named(dataset.name),
    label: named(dataset.label),
    title: named(dataset.title),
    description: inSentence(dataset.description),
    mapExplanation: inSentence(dataset.mapExplanation),
    howToRead: inSentence(dataset.howToRead),
  };
}

/** Every dataset, with its place in its name, label, title and text. */
export const DATASETS: readonly DatasetDef[] = RAW_DATASETS.map(withPlace);

/** The identifier of a registered dataset. A typo in one is a compile error. */
export type DatasetId = (typeof RAW_DATASETS)[number]["id"];

/** The slug of a registered disease. */
export type DiseaseSlug = (typeof DISEASES)[number]["slug"];

/** The dataset that `/map` shows when none is chosen. */
export const DEFAULT_DATASET_ID: DatasetId = RAW_DATASETS[0].id;

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

/**
 * The datasets that give a disease its headline figures, one for each place
 * the disease has data for: the disease's own headline dataset first (the
 * default place), then the first dataset of every other place, in registry
 * order. Figures from different places can be in different measures (COVID-19
 * is cases in England and hospital admissions in the United States), so they
 * are shown side by side, never combined.
 */
export function headlineDatasets(slug: string): DatasetDef[] {
  const disease = getDisease(slug);
  const first = disease && getDataset(disease.headline.datasetId);
  if (!first) return [];
  const places = new Set([first.place.slug]);
  const result = [first];
  for (const dataset of datasetsForDisease(slug)) {
    if (places.has(dataset.place.slug)) continue;
    places.add(dataset.place.slug);
    result.push(dataset);
  }
  return result;
}

/**
 * The areas that a dataset's chart on the disease page draws with its whole
 * place: the disease's `chart.areas` for its headline dataset, and none (the
 * place alone) for the datasets of other places.
 */
export function chartAreas(dataset: DatasetDef): DiseaseDef["chart"]["areas"] {
  const disease = getDisease(dataset.diseaseSlug);
  return disease && disease.headline.datasetId === dataset.id ? disease.chart.areas : null;
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
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A disease's name in the middle of a sentence: "Measles" becomes "measles", but "COVID-19" and "RSV" stay as they are. */
export function diseaseInSentence(name: string): string {
  return /[A-Z]/.test(name.slice(1)) ? name : name.toLowerCase();
}

/** What the site covers in one place, from one publisher, for the list on the home and About pages. */
export type CoverageItem = {
  /** The place, such as "England". */
  place: string;
  /** Its diseases, ready for a sentence: "COVID-19 and measles". */
  diseases: string;
  /** Who publishes the data, such as "UK Health Security Agency". */
  publisher: string;
};

/**
 * What the site covers now, one item for each place and publisher, built
 * from the registry so that it updates itself when a dataset is added. For
 * example "England: COVID-19 and measles, from the UK Health Security Agency"
 * and "United States: influenza, RSV and COVID-19, from the CDC National
 * Healthcare Safety Network (NHSN)".
 */
export function coverageItems(): CoverageItem[] {
  const groups = new Map<string, { place: string; publisher: string; diseases: string[] }>();
  for (const dataset of datasetList) {
    const key = `${dataset.place.slug}|${dataset.publisher}`;
    const group = groups.get(key) ?? {
      place: dataset.place.name,
      publisher: dataset.publisher,
      diseases: [],
    };
    const name = getDisease(dataset.diseaseSlug)?.name;
    const inSentence = name && diseaseInSentence(name);
    if (inSentence && !group.diseases.includes(inSentence)) group.diseases.push(inSentence);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ place, publisher, diseases }) => ({
    place,
    publisher,
    diseases: joinList(diseases),
  }));
}

/** True if `period` is one of the choices that a dataset offers. */
export function offersPeriod(dataset: DatasetDef, period: string): period is PeriodChoice {
  return (dataset.periods as readonly string[]).includes(period);
}
