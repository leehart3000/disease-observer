/** Types shared by the server (which loads the values) and the client (which draws them). */

/** One area's value for a period. */
export type AreaValue = {
  /** The area code that UKHSA uses (matches `code` in the boundary files). */
  code: string;
  name: string;
  value: number;
  /** True while the source says the value may still be revised. */
  provisional: boolean;
};

/** The values for one dataset, all for the same period. */
export type MapDataset = {
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
