import { expect, test } from "@playwright/test";
import { fetchRows, requestUrl, ROW_LIMIT, type NhsnRow } from "../scripts/etl/cdc-nhsn-api.mts";
import {
  areasOf,
  buildSeries,
  METRIC,
  resolveJurisdiction,
} from "../scripts/etl/cdc-nhsn-transform.mts";
import type { HttpClient } from "../scripts/etl/http.mts";
import { buildScale } from "../src/lib/map/scale.ts";
import { formatNumber } from "../src/lib/format.ts";

/**
 * Tests for the NHSN ETL's pure parts (no database, no network): which
 * jurisdictions are ours, how rows become observations, the check on the API's
 * answer, and how the small rates are written. No browser.
 */

/** A client that answers every request with `body`. */
function clientReturning(body: unknown): HttpClient {
  return { getJson: async () => body, requestCount: () => 1 };
}

/** A row as the API returns it, before Zod. */
const apiRow = (jurisdiction: string, week: string, rates: Record<string, string> = {}) => ({
  weekendingdate: `${week}T00:00:00.000`,
  jurisdiction,
  ...rates,
});

test.describe("jurisdictions", () => {
  test("the nation, the states and DC are ours; territories and HHS regions are left out", () => {
    expect(resolveJurisdiction("USA")).toEqual({ scheme: "iso3166-1-alpha3", code: "USA" });
    expect(resolveJurisdiction("AL")).toEqual({ scheme: "iso3166-2", code: "US-AL" });
    expect(resolveJurisdiction("DC")).toEqual({ scheme: "iso3166-2", code: "US-DC" });
    for (const left of ["AS", "GU", "MP", "PR", "VI", "Region 1", "Region 10"]) {
      expect(resolveJurisdiction(left), left).toBeNull();
    }
  });

  test("a jurisdiction it does not know is an error, so nothing is silently dropped", () => {
    for (const unknown of ["ZZ", "Region 11", "United States", ""]) {
      expect(() => resolveJurisdiction(unknown), unknown).toThrow(/Unknown jurisdiction/);
    }
  });
});

test.describe("series", () => {
  const rows: NhsnRow[] = [
    // Parsed rows, as Zod gives them.
    { weekendingdate: "2026-11-07T00:00:00.000", jurisdiction: "USA", totalconfflunewadmper100k: 3.01, totalconfrsvnewadmper100k: 0.38, totalconfc19newadmper100k: 1.38 },
    { weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "USA", totalconfflunewadmper100k: 3.49, totalconfrsvnewadmper100k: 0.48, totalconfc19newadmper100k: 1.49 },
    { weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "WA", totalconfflunewadmper100k: 3.94, totalconfc19newadmper100k: 1.97 },
    { weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "PR", totalconfflunewadmper100k: 7.85 },
    { weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "Region 1", totalconfflunewadmper100k: 2.35 },
  ];

  test("make one series for each area and disease that has a value, and leave out the rest", () => {
    const series = buildSeries(rows);
    const keys = series.map(({ area, diseaseSlug }) => `${area.code}/${diseaseSlug}`).sort();
    // WA has no RSV value, Puerto Rico and the HHS region are left out.
    expect(keys).toEqual([
      "US-WA/covid-19",
      "US-WA/influenza",
      "USA/covid-19",
      "USA/influenza",
      "USA/rsv",
    ]);
    expect(areasOf(series).map((area) => area.code).sort()).toEqual(["US-WA", "USA"]);
  });

  test("a week is Sunday to Saturday, from the day the source gives, and the latest week is provisional", () => {
    const usa = buildSeries(rows).find(({ area, diseaseSlug }) => area.code === "USA" && diseaseSlug === "influenza")!;
    expect(usa.observations).toEqual([
      { metric: METRIC, stratum: "all", periodType: "week", periodStart: "2026-11-01", periodEnd: "2026-11-07", value: 3.01, provisional: false },
      { metric: METRIC, stratum: "all", periodType: "week", periodStart: "2026-11-08", periodEnd: "2026-11-14", value: 3.49, provisional: true },
    ]);
    // Each series has its own latest week: WA's COVID-19 series has one week, and it is provisional.
    const wa = buildSeries(rows).find(({ area, diseaseSlug }) => area.code === "US-WA" && diseaseSlug === "covid-19")!;
    expect(wa.observations.map((o) => o.provisional)).toEqual([true]);
  });

  test("a week with no value is not stored, and a repeated week keeps the last", () => {
    const series = buildSeries([
      { weekendingdate: "2026-11-07T00:00:00.000", jurisdiction: "AL", totalconfflunewadmper100k: undefined },
      { weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "AL", totalconfflunewadmper100k: 2 },
      { weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "AL", totalconfflunewadmper100k: 2.5 },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].observations.map((o) => o.value)).toEqual([2.5]);
  });

  test("an unknown jurisdiction stops the build of the series", () => {
    expect(() =>
      buildSeries([{ weekendingdate: "2026-11-14T00:00:00.000", jurisdiction: "ZZ", totalconfflunewadmper100k: 1 }]),
    ).toThrow(/Unknown jurisdiction/);
  });
});

test.describe("the request and the response", () => {
  test("is one request for the weeks from the year given, ordered, with room for every row", () => {
    const url = new URL(requestUrl(2023));
    expect(url.origin + url.pathname).toBe("https://data.cdc.gov/resource/ua7e-t2fy.json");
    expect(url.searchParams.get("$where")).toBe("weekendingdate >= '2023-01-01T00:00:00'");
    expect(url.searchParams.get("$order")).toBe("weekendingdate,jurisdiction");
    expect(url.searchParams.get("$select")).toBe(
      "weekendingdate,jurisdiction,totalconfflunewadmper100k,totalconfrsvnewadmper100k,totalconfc19newadmper100k",
    );
    expect(url.searchParams.get("$limit")).toBe(String(ROW_LIMIT));
  });

  test("numbers written as text become numbers, and a missing one stays missing", async () => {
    const rows = await fetchRows(
      clientReturning([apiRow("USA", "2026-11-14", { totalconfflunewadmper100k: "3.49", totalconfc19newadmper100k: "0.0" })]),
      2023,
    );
    expect(rows).toEqual([
      {
        weekendingdate: "2026-11-14T00:00:00.000",
        jurisdiction: "USA",
        totalconfflunewadmper100k: 3.49,
        totalconfc19newadmper100k: 0,
      },
    ]);
  });

  test("a negative or non-numeric rate, a bad date and a body that is not a list are refused", async () => {
    for (const bad of [
      [apiRow("USA", "2026-11-14", { totalconfflunewadmper100k: "-1" })],
      [apiRow("USA", "2026-11-14", { totalconfflunewadmper100k: "n/a" })],
      [{ weekendingdate: "last week", jurisdiction: "USA" }],
      { error: true },
    ]) {
      await expect(fetchRows(clientReturning(bad), 2023)).rejects.toThrow();
    }
  });

  test("a full page is refused, because rows may be missing", async () => {
    const full = Array.from({ length: ROW_LIMIT }, () => apiRow("USA", "2026-11-14"));
    await expect(fetchRows(clientReturning(full), 2023)).rejects.toThrow(/the most a request can return/);
  });
});

test.describe("small rates", () => {
  test("are written with the decimal places asked for, and one by default", () => {
    expect(formatNumber(0.06)).toBe("0.1");
    expect(formatNumber(0.06, 2)).toBe("0.06");
    expect(formatNumber(3.49, 2)).toBe("3.49");
    expect(formatNumber(1234.5, 2)).toBe("1,234.5");
  });

  test("the key's class labels have the decimal places too, so small classes stay distinct", () => {
    const values = [0.06, 0.08, 0.1, 0.14, 0.21, 0.37, 0.52, 0.9, 1.4, 2.6];
    const config = { classes: 4, rounding: "2sf", zeroClass: false } as const;
    const withOne = buildScale(values, config).classes.map((c) => c.label);
    const withTwo = buildScale(values, config, 2).classes.map((c) => c.label);
    // At one decimal place the boundaries 0.14 and 0.21 would both read "0.1" and "0.2".
    expect(new Set(withTwo).size).toBe(withTwo.length);
    expect(withTwo.join("|")).toMatch(/0\.\d\d/);
    expect(withOne.join("|")).not.toMatch(/0\.\d\d/);
  });
});
