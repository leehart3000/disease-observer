import type { DatasetDef } from "@/lib/datasets/types";
import { formatPeriod, formatValue } from "@/lib/format";
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
  const found: AreaValue | undefined = values.values.find((entry) => entry.code === area.code);
  return (
    <div>
      <p className="font-medium">{area.name}</p>
      {found ? (
        <>
          <p>{formatValue(dataset, found.value)}</p>
          <p className="text-sm text-muted">
            {formatPeriod(dataset, values.periodStart, values.periodEnd)}
          </p>
          {found.provisional ? <p className="text-sm font-medium">Provisional</p> : null}
        </>
      ) : (
        <p className="text-muted">No data for this period</p>
      )}
      {pinned ? (
        <p className="mt-1 text-xs text-muted">
          Pinned. To unpin: click or tap it again, or press Escape.
        </p>
      ) : null}
    </div>
  );
}
