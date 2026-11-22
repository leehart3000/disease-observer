/** Types shared by the server (which loads the values) and the client (which draws them). */
import type { PeriodChoice } from "@/lib/datasets/types";

/** One area's value for a period. */
export type AreaValue = {
  /** The area code that UKHSA uses (matches `code` in the boundary files). */
  code: string;
  name: string;
  value: number;
  /** True while the source says the value may still be revised (for a total, if any week in it is). */
  provisional: boolean;
  /** How many weeks of the period this area has a value for. Always 1 for the latest period. */
  weeks: number;
};

/** The values for one dataset, all for the same period. */
export type MapDataset = {
  /** Which period this is: the latest week, the last 12 weeks, or the year to date. */
  period: PeriodChoice;
  /** How many weeks the period covers in the data (1, 12 or so, or the weeks of the year so far). */
  weeksExpected: number;
  /** First day of the period, as `YYYY-MM-DD`. */
  periodStart: string;
  /** Last day of the period, inclusive, as `YYYY-MM-DD`. */
  periodEnd: string;
  values: AreaValue[];
};

/** The credit and licence for a data source, from the `sources` table. */
export type SourceCredit = {
  slug: string;
  name: string;
  url: string;
  licenceName: string;
  licenceUrl: string;
  attribution: string;
};
