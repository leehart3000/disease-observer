import { formatPeriod, formatValue } from "@/lib/map/layers";
import type { AreaValue, LayerKey, MapDataset } from "@/lib/map/types";
import type { SelectedArea } from "./ChoroplethMap";

/**
 * Shows the figure for an area: its name, value, period and whether the
 * value is provisional. Pointing at an area previews it. Clicking or
 * tapping it (or choosing it in the table) pins it, so the readout stays.
 */
export function AreaReadout({
  layer,
  dataset,
  area,
  pinned,
}: {
  layer: LayerKey;
  dataset: MapDataset | null;
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
  const found: AreaValue | undefined = dataset?.values.find((entry) => entry.code === area.code);
  return (
    <div>
      <p className="font-medium">{area.name}</p>
      {found && dataset ? (
        <>
          <p>{formatValue(layer, found.value)}</p>
          <p className="text-sm text-muted">
            {formatPeriod(layer, dataset.periodStart, dataset.periodEnd)}
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
