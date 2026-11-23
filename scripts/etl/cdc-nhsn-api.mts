/**
 * Reads the CDC National Healthcare Safety Network (NHSN) "Weekly Hospital
 * Respiratory Data (HRD) Metrics by Jurisdiction" dataset from data.cdc.gov
 * (dataset `ua7e-t2fy`, licence "Public Domain U.S. Government"), checked
 * with Zod.
 *
 * It is one request: from 2023 the dataset has about 13,500 rows (one for each
 * jurisdiction and week), well under the 50,000 a request can return.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */
import { z } from "zod";
import type { HttpClient } from "./http.mts";

/** Where the dataset's rows are. */
export const DATASET_URL = "https://data.cdc.gov/resource/ua7e-t2fy.json";

/** The most rows one request can return. A full page means rows may be missing. */
export const ROW_LIMIT = 50_000;

/** The columns this ETL reads, besides the week and the jurisdiction. */
export const RATE_COLUMNS = [
  "totalconfflunewadmper100k",
  "totalconfrsvnewadmper100k",
  "totalconfc19newadmper100k",
] as const;

/**
 * A rate as the API gives it: a number written as text, or missing when the
 * source has no figure. Negative or non-numeric values are refused.
 */
const rateSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "not a non-negative number")
  .transform(Number)
  .optional();

/** One row: the week it ends, the jurisdiction and the three rates. */
const rowSchema = z.object({
  /** The Saturday that ends the week, as `2026-11-14T00:00:00.000`. */
  weekendingdate: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
  /** `USA`, a state or territory code such as `AL`, or an HHS region such as `Region 4`. */
  jurisdiction: z.string().min(1),
  totalconfflunewadmper100k: rateSchema,
  totalconfrsvnewadmper100k: rateSchema,
  totalconfc19newadmper100k: rateSchema,
});

/** A row of the dataset. */
export type NhsnRow = z.infer<typeof rowSchema>;

/** The address of the one request, for weeks ending on or after January 1 of `fromYear`. */
export function requestUrl(fromYear: number): string {
  const params = new URLSearchParams({
    $select: ["weekendingdate", "jurisdiction", ...RATE_COLUMNS].join(","),
    $where: `weekendingdate >= '${fromYear}-01-01T00:00:00'`,
    $order: "weekendingdate,jurisdiction",
    $limit: String(ROW_LIMIT),
  });
  return `${DATASET_URL}?${params}`;
}

/**
 * Fetches the rows for weeks from `fromYear`.
 *
 * @throws If the response is not rows of the expected shape, or is a full
 *   page (so rows may be missing).
 */
export async function fetchRows(http: HttpClient, fromYear: number): Promise<NhsnRow[]> {
  const body = await http.getJson(requestUrl(fromYear));
  const rows = z.array(rowSchema).parse(body);
  if (rows.length >= ROW_LIMIT) {
    throw new Error(`The response has ${rows.length} rows, the most a request can return`);
  }
  return rows;
}
