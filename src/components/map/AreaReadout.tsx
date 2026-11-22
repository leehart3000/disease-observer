import Link from "next/link";
import { chartAreaHref } from "@/lib/datasets/routes";
import type { DatasetDef } from "@/lib/datasets/types";
import { formatCoverage, formatPeriod, formatValue } from "@/lib/format";
import type { AreaValue, MapDataset } from "@/lib/map/types";
import type { SelectedArea } from "./ChoroplethMap";

/**
 * Shows the figure for an area: its name, value, period and whether the
 * value is provisional. Pointing at an area previews it. Clicking or
 * tapping it (or choosing it in the table) pins it, so the readout stays.
 */
export function AreaReadout({
  dataset,
  values,
  area,
  pinned,
}: {
  dataset: DatasetDef;
  values: MapDataset;
  area: SelectedArea | null;
  /** True if `area` is pinned rather than just pointed at. */
  pinned: boolean;
}) {
  if (!area) {
    return (
      <p className="text-sm text-muted">
        Point at an area on the map, or tap it, to see its figure.
      </p>
    );
  }
  // Only a dataset whose chart compares areas has a chart to link to.
  const chartHref = chartAreaHref(dataset, area.code);
  const found: AreaValue | undefined = values.values.find((entry) => entry.code === area.code);
  const coverage = found ? formatCoverage(found.weeks, values.weeksExpected) : null;
  return (
    <div>
      <p className="font-medium">{area.name}</p>
      {found ? (
        <>
          <p>{formatValue(dataset, found.value)}</p>
          <p className="text-sm text-muted">
            {formatPeriod(dataset, values.periodStart, values.periodEnd, values.period)}
          </p>
          {coverage ? <p className="text-sm text-muted">{coverage}</p> : null}
          {found.provisional ? <p className="text-sm font-medium">Provisional</p> : null}
        </>
      ) : (
        <p className="text-muted">No data for this period</p>
      )}
      {chartHref ? (
        <Link
          href={chartHref}
          aria-label={`Chart this area: ${area.name}`}
          className="-ml-2 mt-1 inline-flex min-h-11 items-center rounded-md px-2 text-brand underline underline-offset-4 hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
        >
          Chart this area
        </Link>
      ) : null}
      {pinned ? (
        <p className="mt-1 text-xs text-muted">
          Pinned. To unpin: click or tap it again, or press Escape.
        </p>
      ) : null}
    </div>
  );
}
