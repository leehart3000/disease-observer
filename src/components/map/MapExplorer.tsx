"use client";

import { useCallback, useMemo, useState } from "react";
import { LAYER_KEYS, LAYERS } from "@/lib/map/layers";
import { buildScale } from "@/lib/map/scale";
import type { LayerKey, MapData } from "@/lib/map/types";
import { AreaReadout } from "./AreaReadout";
import { ChoroplethMap, type SelectedArea } from "./ChoroplethMap";
import { Legend } from "./Legend";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { ValuesTable } from "./ValuesTable";

/**
 * The map page's interactive part: the layer toggle, the map with its key
 * and readout, and the table of values. It is rendered on the server too,
 * so the table is in the first HTML. The map itself only starts in the
 * browser.
 */
export function MapExplorer({ data }: { data: MapData }) {
  const available = LAYER_KEYS.filter((key) => data[key] !== null);
  const [layer, setLayer] = useState<LayerKey>(available[0] ?? "covid");
  const [selected, setSelected] = useState<SelectedArea | null>(null);
  const [areaCounts, setAreaCounts] = useState<Partial<Record<LayerKey, number>>>({});

  const dataset = data[layer];
  const config = LAYERS[layer];
  const scale = useMemo(
    () =>
      dataset
        ? buildScale(
            dataset.values.map((area) => area.value),
            config.valueKind,
          )
        : null,
    [dataset, config.valueKind],
  );

  const onAreaCount = useCallback((key: LayerKey, count: number) => {
    setAreaCounts((current) => (current[key] === count ? current : { ...current, [key]: count }));
  }, []);

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium text-muted">Show on the map</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {LAYER_KEYS.map((key) => (
            <label
              key={key}
              className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 has-checked:border-brand has-checked:bg-brand has-checked:text-paper has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
            >
              <input
                type="radio"
                name="map-layer"
                value={key}
                checked={layer === key}
                disabled={data[key] === null}
                onChange={() => setLayer(key)}
                className="sr-only"
              />
              <span>
                {LAYERS[key].label}
                {data[key] === null ? " (no data yet)" : ""}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <a
        href="#values-table"
        className="sr-only rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-brand"
      >
        Skip to the table of values
      </a>

      <div className="lg:relative">
        <div
          role="region"
          aria-label={`Map: ${config.title}. The same values are in the table below.`}
          className="relative h-[26rem] overflow-hidden rounded-md border border-line bg-surface lg:h-[36rem]"
        >
          <MapErrorBoundary>
            <ChoroplethMap
              layer={layer}
              dataset={dataset}
              scale={scale}
              onSelect={setSelected}
              onAreaCount={onAreaCount}
            />
          </MapErrorBoundary>
        </div>
        <div
          data-testid="area-readout"
          data-empty={selected === null}
          className="mt-3 rounded-md border border-line bg-surface p-3 lg:absolute lg:top-3 lg:left-3 lg:mt-0 lg:w-64 lg:bg-surface/95 lg:shadow-sm lg:data-[empty=true]:hidden"
        >
          <AreaReadout layer={layer} dataset={dataset} area={selected} />
        </div>
        {scale ? (
          <div className="mt-3 lg:absolute lg:bottom-9 lg:left-3 lg:mt-0">
            <Legend scale={scale} heading={config.title} />
          </div>
        ) : null}
      </div>

      <section id="values-table" aria-label="Table of values" className="scroll-mt-4">
        {dataset ? (
          <ValuesTable
            key={layer}
            layer={layer}
            dataset={dataset}
            areaCount={areaCounts[layer] ?? null}
          />
        ) : (
          <p className="text-muted">There is no data for this layer yet.</p>
        )}
      </section>
    </div>
  );
}
