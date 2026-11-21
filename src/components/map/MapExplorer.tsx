"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { LAYER_KEYS, LAYERS } from "@/lib/map/layers";
import { buildScale } from "@/lib/map/scale";
import type { LayerKey, MapData } from "@/lib/map/types";
import { AreaReadout } from "./AreaReadout";
import { ChoroplethMap, type SelectedArea } from "./ChoroplethMap";
import { Legend } from "./Legend";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { Sources } from "./Sources";
import { useExpandable } from "./useExpandable";
import { ValuesTable } from "./ValuesTable";

/**
 * The map page's interactive part: the layer toggle, the map with its key
 * and readout, the table of values and the sources. It is rendered on the
 * server too, so the table is in the first HTML. The map itself only starts
 * in the browser.
 *
 * Pointing at an area previews it. Clicking or tapping it, or choosing it
 * in the table, pins it, so the readout stays. Pressing Escape, clicking
 * empty map, or choosing the pinned area again unpins it.
 *
 * The full screen button expands one wrapper that holds the map, the key
 * and the readout (see `useExpandable`).
 */
export function MapExplorer({ data }: { data: MapData }) {
  const available = LAYER_KEYS.filter((key) => data[key] !== null);
  const [layer, setLayer] = useState<LayerKey>(available[0] ?? "covid");
  const [hovered, setHovered] = useState<SelectedArea | null>(null);
  const [pinned, setPinned] = useState<SelectedArea | null>(null);
  const [areaCounts, setAreaCounts] = useState<Partial<Record<LayerKey, number>>>({});
  const frameRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const expand = useExpandable(frameRef, buttonRef);
  // While the frame fills the viewport with CSS, the rest of the page is out of reach.
  const behind = expand.mode === "css";

  const dataset = data[layer];
  const config = LAYERS[layer];
  const shown = pinned ?? hovered;
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
  const credits = config.sourceSlugs.flatMap((slug) =>
    data.sources.filter((source) => source.slug === slug),
  );

  const onAreaCount = useCallback((key: LayerKey, count: number) => {
    setAreaCounts((current) => (current[key] === count ? current : { ...current, [key]: count }));
  }, []);

  /** Pins an area, or unpins it if it is already pinned. `null` unpins. */
  const togglePin = useCallback((area: SelectedArea | null) => {
    setPinned((current) => (area === null || current?.code === area.code ? null : area));
  }, []);

  function chooseLayer(key: LayerKey) {
    setLayer(key);
    setHovered(null);
    setPinned(null);
  }

  return (
    <div
      className="grid gap-4"
      onKeyDown={(event) => {
        // In the CSS expanded mode, Escape leaves the mode (see useExpandable)
        // and keeps the pin.
        if (event.key === "Escape" && !behind) {
          setPinned(null);
          setHovered(null);
        }
      }}
    >
      <fieldset inert={behind} className="grid gap-2">
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
                onChange={() => chooseLayer(key)}
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
        inert={behind}
        className="sr-only rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:outline-2 focus:outline-offset-2 focus:outline-brand"
      >
        Skip to the table of values
      </a>

      <div
        ref={frameRef}
        data-expanded={expand.expanded}
        data-mode={expand.mode ?? undefined}
        className="map-frame lg:relative"
      >
        <div
          role="region"
          aria-label={`Map: ${config.title}. The same values are in the table below.`}
          className="map-region relative h-[26rem] overflow-hidden rounded-md border border-line bg-surface lg:h-[36rem]"
        >
          <MapErrorBoundary>
            <ChoroplethMap
              layer={layer}
              dataset={dataset}
              scale={scale}
              highlightCode={shown?.code ?? null}
              expanded={expand.expanded}
              onToggleExpanded={expand.toggle}
              onFullscreenButton={(button) => {
                buttonRef.current = button;
              }}
              onHover={setHovered}
              onSelect={togglePin}
              onAreaCount={onAreaCount}
            />
          </MapErrorBoundary>
        </div>
        <div
          data-testid="area-readout"
          data-empty={shown === null}
          aria-live={pinned ? "polite" : "off"}
          className="map-readout mt-3 rounded-md border border-line bg-surface p-3 lg:absolute lg:top-3 lg:left-3 lg:mt-0 lg:w-64 lg:bg-surface/95 lg:shadow-sm lg:data-[empty=true]:hidden"
        >
          <AreaReadout layer={layer} dataset={dataset} area={shown} pinned={pinned !== null} />
        </div>
        {scale ? (
          <div className="map-legend mt-3 lg:absolute lg:bottom-9 lg:left-3 lg:mt-0">
            <Legend scale={scale} heading={config.title} />
          </div>
        ) : null}
      </div>

      <section
        id="values-table"
        aria-label="Table of values"
        inert={behind}
        className="scroll-mt-4"
      >
        {dataset ? (
          <ValuesTable
            key={layer}
            layer={layer}
            dataset={dataset}
            areaCount={areaCounts[layer] ?? null}
            pinned={pinned}
            onPin={togglePin}
          />
        ) : (
          <p className="text-muted">There is no data for this layer yet.</p>
        )}
      </section>

      <div inert={behind}>
        <Sources credits={credits} />
      </div>
    </div>
  );
}
