import type { AreaSeries, DiseaseSeries, SeriesLine } from "./series-types";

/**
 * The most areas that can be compared with England on one chart. Each has
 * its own colour (`--chart-1` to `--chart-3` in `globals.css`), and three
 * is how many pass the palette checks together in both themes. It is here,
 * not in a component file, so server code can import it too.
 */
export const MAX_COMPARED_AREAS = 3;

/**
 * Builds a chart's series from England's weekly points and the chosen
 * areas'. The weeks are England's, so every line shares one x axis; a week
 * an area has no point for is `null`. Points on a week England does not
 * have are dropped. England is first, then the areas in the order given.
 *
 * @param england - England's series (the weeks on the chart).
 * @param areas - The chosen areas' series, in the order of their colours.
 */
export function composeSeries(
  diseaseSlug: string,
  datasetId: string,
  england: AreaSeries,
  areas: readonly AreaSeries[],
): DiseaseSeries {
  const periods = england.points.map(({ start, end, provisional }) => ({ start, end, provisional }));
  const indexOfEnd = new Map(periods.map((period, index) => [period.end, index]));
  const lineOf = (area: AreaSeries): SeriesLine => {
    const values: Array<number | null> = periods.map(() => null);
    for (const point of area.points) {
      const index = indexOfEnd.get(point.end);
      if (index !== undefined) values[index] = point.value;
    }
    return { code: area.code, name: area.name, level: area.level, values };
  };
  return { diseaseSlug, datasetId, periods, lines: [lineOf(england), ...areas.map(lineOf)] };
}
