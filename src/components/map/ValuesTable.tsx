"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatPeriod, LAYERS } from "@/lib/map/layers";
import type { LayerKey, MapDataset } from "@/lib/map/types";

type SortKey = "name" | "value" | "status";
type SortDirection = "ascending" | "descending";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Area" },
  { key: "value", label: "Value", numeric: true },
  { key: "status", label: "Status" },
];

/**
 * The same values as the map, as a table that can be sorted. It is the way
 * to read the figures with a keyboard or a screen reader. It is also in the
 * page's first HTML, so it works before the map has loaded.
 */
export function ValuesTable({
  layer,
  dataset,
  areaCount,
}: {
  layer: LayerKey;
  dataset: MapDataset;
  /** How many areas the map draws for this layer, once known. */
  areaCount: number | null;
}) {
  const config = LAYERS[layer];
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "value",
    direction: "descending",
  });

  const rows = useMemo(() => {
    const factor = sort.direction === "ascending" ? 1 : -1;
    return [...dataset.values].sort((a, b) => {
      let result = 0;
      if (sort.key === "value") result = a.value - b.value;
      else if (sort.key === "status") result = Number(a.provisional) - Number(b.provisional);
      else result = a.name.localeCompare(b.name, "en-GB");
      return result * factor || a.name.localeCompare(b.name, "en-GB");
    });
  }, [dataset, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "ascending" ? "descending" : "ascending" }
        : { key, direction: key === "value" ? "descending" : "ascending" },
    );
  }

  const anyProvisional = dataset.values.some((area) => area.provisional);
  const withoutFigure = areaCount === null ? 0 : areaCount - dataset.values.length;

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption aria-live="polite" className="px-3 py-3 text-left">
            <span className="block font-medium">{config.title}</span>
            <span className="block text-muted">
              {formatPeriod(layer, dataset.periodStart, dataset.periodEnd)}
              {anyProvisional ? ". Some values are provisional and may change." : ""}
            </span>
          </caption>
          <thead>
            <tr className="border-y border-line bg-paper">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort.key === column.key ? sort.direction : "none"}
                  className={`p-0 font-medium ${column.numeric ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-1 px-3 hover:bg-line/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${column.numeric ? "justify-end" : ""}`}
                  >
                    {column.label}
                    <span aria-hidden="true" className="text-muted">
                      {sort.key === column.key
                        ? sort.direction === "ascending"
                          ? "▲"
                          : "▼"
                        : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((area) => (
              <tr key={area.code} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3 py-2 font-normal">
                  {area.name}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatNumber(area.value)}
                </td>
                <td className="px-3 py-2">{area.provisional ? "Provisional" : "Not provisional"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {withoutFigure > 0 ? (
        <p className="mt-2 text-sm text-muted">
          {withoutFigure} {withoutFigure === 1 ? "area" : "areas"} on the map{" "}
          {withoutFigure === 1 ? "has" : "have"} no figure for this period.
        </p>
      ) : null}
    </div>
  );
}
