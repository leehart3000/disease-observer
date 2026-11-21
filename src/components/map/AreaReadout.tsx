import { formatPeriod, formatValue } from "@/lib/map/layers";
import type { AreaValue, LayerKey, MapDataset } from "@/lib/map/types";
import type { SelectedArea } from "./ChoroplethMap";

/**
 * Shows the figure for the area that the visitor is pointing at (on a
 * computer) or has tapped (on a phone): its name, value, period and whether
 * the value is provisional.
 */
export function AreaReadout({
  layer,
  dataset,
  area,
}: {
  layer: LayerKey;
  dataset: MapDataset | null;
  area: SelectedArea | null;
}) {
  if (!area) {
    return (
      <p className="text-sm text-muted">
        Point at or tap an area on the map to see its figure.
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
    </div>
  );
}
