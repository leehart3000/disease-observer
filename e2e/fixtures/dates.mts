/**
 * The dates and England values that the end-to-end fixtures use, worked out
 * from today so the tests never go stale. The fixture loader and the tests
 * share this file, so the tests can say what the loader stored.
 *
 * No imports, and erasable TypeScript only.
 */

/** Adds days to a `YYYY-MM-DD` date, using UTC. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/**
 * The dates the fixtures use.
 *
 * - COVID-19: a week ending three days ago (the latest), and the week before.
 * - Measles: the last complete week (Monday to Sunday, ended before today),
 *   and the week after it, which has not ended yet and so must be ignored.
 */
export function fixtureDates(now: Date = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const covidEnd = addDays(today, -3);
  // Days back to the most recent Sunday that is before today.
  const dayOfWeek = now.getUTCDay();
  const measlesEnd = addDays(today, -(dayOfWeek === 0 ? 7 : dayOfWeek));
  return {
    covidLatest: { start: addDays(covidEnd, -6), end: covidEnd },
    covidPrevious: { start: addDays(covidEnd, -13), end: addDays(covidEnd, -7) },
    measlesComplete: { start: addDays(measlesEnd, -6), end: measlesEnd },
    measlesIncomplete: { start: addDays(measlesEnd, 1), end: addDays(measlesEnd, 7) },
  };
}

/** How many weekly England values the fixtures hold, counting the latest. */
export const ENGLAND_WEEKS = 70;

/**
 * How many of those weeks are in the chart's default view, the last 12
 * months: weeks that end less than 365 days before the latest week's end.
 */
export const LAST_YEAR_WEEKS = 53;

/** England's COVID-19 rate `weeksBack` weeks before the latest: 12.6, 12.5, 12.4, and so on. */
export function englandCovidRate(weeksBack: number): number {
  return Math.round((12.6 - weeksBack * 0.1) * 10) / 10;
}

/** England's measles cases `weeksBack` weeks before the latest complete week: 80, 79, 78, and so on. */
export function englandMeaslesCases(weeksBack: number): number {
  return 80 - weeksBack;
}

/**
 * A region's COVID-19 rate `weeksBack` weeks before the latest. The nine
 * regions, in the order of `REGIONS` in the loader, sit 0.5 apart around
 * England's value.
 */
export function regionCovidRate(regionIndex: number, weeksBack: number): number {
  return Math.round((englandCovidRate(weeksBack) + (regionIndex - 4) * 0.5) * 10) / 10;
}

/** A region's measles cases in an older week. The latest week's values are in `MEASLES_LATEST_CASES`. */
export function regionMeaslesCases(regionIndex: number, weeksBack: number): number {
  return (regionIndex + weeksBack) % 4;
}

/** Measles cases for each region (in the order of `REGIONS` in the loader) in the latest complete week. Four have none. */
export const MEASLES_LATEST_CASES = [0, 0, 0, 0, 1, 2, 3, 5, 8];

/**
 * The first region has no measles row for the week 3 weeks before the latest,
 * so it is missing from the last 12 weeks and the year to date once.
 */
const MISSING_MEASLES_WEEK = { regionIndex: 0, weeksBack: 3 };

/** True if the fixtures leave out this region's measles row for the week `weeksBack` before the latest. */
export function isMissingMeaslesWeek(regionIndex: number, weeksBack: number): boolean {
  return (
    regionIndex === MISSING_MEASLES_WEEK.regionIndex && weeksBack === MISSING_MEASLES_WEEK.weeksBack
  );
}

/**
 * What the map and table show for a region's measles cases in a period,
 * worked out from the fixture rows the same way the page's query does:
 *
 * - `latest`: the latest complete week.
 * - `12w`: that week and the 11 before it, added up.
 * - `ytd`: the weeks that start in the same calendar year as the latest week.
 *
 * `expected` is the number of weeks in the period (every other region has all of them).
 */
export function measlesPeriodTotal(
  regionIndex: number,
  period: "latest" | "12w" | "ytd",
  dates: ReturnType<typeof fixtureDates>,
) {
  const latestYear = dates.measlesComplete.start.slice(0, 4);
  const weeksBack: number[] = [];
  for (let back = 0; back < ENGLAND_WEEKS; back++) {
    const start = addDays(dates.measlesComplete.start, -7 * back);
    const inPeriod =
      period === "latest" ? back === 0 : period === "12w" ? back < 12 : start.slice(0, 4) === latestYear;
    if (inPeriod) weeksBack.push(back);
  }
  const present = weeksBack.filter((back) => !isMissingMeaslesWeek(regionIndex, back));
  const oldest = weeksBack[weeksBack.length - 1];
  return {
    value: present.reduce(
      (sum, back) =>
        sum + (back === 0 ? MEASLES_LATEST_CASES[regionIndex] : regionMeaslesCases(regionIndex, back)),
      0,
    ),
    weeks: present.length,
    expected: weeksBack.length,
    start: addDays(dates.measlesComplete.start, -7 * oldest),
    end: dates.measlesComplete.end,
  };
}

/**
 * The England rows for COVID-19 and measles: a weekly series, plus rows that
 * must not appear in a weekly series. COVID-19 also has a row for the day
 * before the latest, as the real data has one a day. Measles also has a
 * provisional week that has not ended yet.
 */
export function englandRows(dates: ReturnType<typeof fixtureDates>) {
  const covid: Array<{ start: string; end: string; value: number; provisional: boolean }> = [];
  const measles: Array<{ start: string; end: string; value: number; provisional: boolean }> = [];
  for (let back = 0; back < ENGLAND_WEEKS; back++) {
    covid.push({
      start: addDays(dates.covidLatest.start, -7 * back),
      end: addDays(dates.covidLatest.end, -7 * back),
      value: englandCovidRate(back),
      provisional: back === 0,
    });
    measles.push({
      start: addDays(dates.measlesComplete.start, -7 * back),
      end: addDays(dates.measlesComplete.end, -7 * back),
      value: englandMeaslesCases(back),
      provisional: back === 0,
    });
  }
  covid.push({
    start: addDays(dates.covidLatest.start, -1),
    end: addDays(dates.covidLatest.end, -1),
    value: 999,
    provisional: false,
  });
  measles.push({ ...dates.measlesIncomplete, value: 99, provisional: true });
  return { covid, measles };
}
