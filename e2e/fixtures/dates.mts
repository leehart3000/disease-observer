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
export const ENGLAND_WEEKS = 30;

/** England's COVID-19 rate `weeksBack` weeks before the latest: 12.6, 12.3, 12.0, and so on. */
export function englandCovidRate(weeksBack: number): number {
  return Math.round((12.6 - weeksBack * 0.3) * 10) / 10;
}

/** England's measles cases `weeksBack` weeks before the latest complete week: 40, 39, 38, and so on. */
export function englandMeaslesCases(weeksBack: number): number {
  return 40 - weeksBack;
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
