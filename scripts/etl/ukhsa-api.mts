/**
 * Reads the UKHSA data dashboard API: lists of geographies and pages of
 * data points, checked with Zod.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */
import { z } from "zod";
import type { HttpClient } from "./http.mts";

/** Where the API lives. Links to further pages must stay on this origin. */
export const API_ORIGIN = "https://api.ukhsa-dashboard.data.gov.uk";

const THEME_PATH = "/themes/infectious_disease/sub_themes";

/** The most rows the API returns in one page. */
const PAGE_SIZE = 365;

/** A stop in case a `next` link ever loops. */
const MAX_PAGES = 50;

/** One entry in a list of geographies. */
const geographyListSchema = z.array(z.object({ name: z.string().min(1) }));

/**
 * One data point. Fields that this ETL does not use are left out, and Zod
 * drops them from the result. `metric_value` can be null in case the source
 * hides a small number.
 */
const pointSchema = z.object({
  geography: z.string().min(1),
  geography_code: z.string().min(1),
  metric: z.string().min(1),
  stratum: z.string(),
  sex: z.string(),
  age: z.string(),
  date: z.iso.date(),
  metric_value: z.number().nullable(),
  in_reporting_delay_period: z.boolean(),
});

/** One page of data points. */
const pageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  results: z.array(pointSchema),
});

/** A data point from the API. */
export type UkhsaPoint = z.infer<typeof pointSchema>;

/** Which series to fetch. */
export type SeriesQuery = {
  subTheme: string;
  topic: string;
  geographyType: string;
  geography: string;
  metric: string;
  /** Only fetch points dated in this calendar year. */
  year?: number;
};

/** The points of one series, with a note if the API's own count disagrees. */
export type SeriesResult = {
  points: UkhsaPoint[];
  /** The `count` the API reported for the whole series. */
  reportedCount: number;
  /** The number of pages fetched. */
  pages: number;
};

function topicPath(query: Pick<SeriesQuery, "subTheme" | "topic" | "geographyType">) {
  const { subTheme, topic, geographyType } = query;
  return (
    `${API_ORIGIN}${THEME_PATH}/${encodeURIComponent(subTheme)}` +
    `/topics/${encodeURIComponent(topic)}` +
    `/geography_types/${encodeURIComponent(geographyType)}`
  );
}

/** Lists the names of the geographies of one type for a topic. */
export async function fetchGeographyNames(
  http: HttpClient,
  query: Pick<SeriesQuery, "subTheme" | "topic" | "geographyType">,
): Promise<string[]> {
  const body = await http.getJson(`${topicPath(query)}/geographies`);
  return geographyListSchema.parse(body).map((entry) => entry.name);
}

/**
 * Fetches every page of one series (one metric for one geography).
 *
 * @throws {NotFoundError} If the geography or metric does not exist.
 * @throws {z.ZodError} If a page is not in the expected shape.
 */
export async function fetchSeries(
  http: HttpClient,
  query: SeriesQuery,
): Promise<SeriesResult> {
  const params = new URLSearchParams({ page_size: String(PAGE_SIZE) });
  if (query.year !== undefined) params.set("year", String(query.year));

  let url: string | null =
    `${topicPath(query)}/geographies/${encodeURIComponent(query.geography)}` +
    `/metrics/${encodeURIComponent(query.metric)}?${params}`;
  const points: UkhsaPoint[] = [];
  let reportedCount = 0;
  let pages = 0;

  while (url !== null) {
    if (pages >= MAX_PAGES) {
      throw new Error(`More than ${MAX_PAGES} pages for ${query.geography}`);
    }
    const page = pageSchema.parse(await http.getJson(url));
    if (pages === 0) reportedCount = page.count;
    points.push(...page.results);
    pages++;
    if (page.next !== null && new URL(page.next).origin !== API_ORIGIN) {
      throw new Error("The API sent a link to a different site");
    }
    url = page.next;
  }
  return { points, reportedCount, pages };
}
