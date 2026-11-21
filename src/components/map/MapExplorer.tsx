"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getDataset } from "@/lib/datasets/registry";
import { buildScale } from "@/lib/map/scale";
import type { MapDataset, SourceCredit } from "@/lib/map/types";
import { AreaReadout } from "./AreaReadout";
import { ChoroplethMap, type AreaRect, type SelectedArea } from "./ChoroplethMap";
import { DatasetPicker } from "./DatasetPicker";
import { Legend } from "./Legend";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { Sources } from "./Sources";
import { useExpandable } from "./useExpandable";
import { ValuesTable } from "./ValuesTable";

/** Screens narrower than this (Tailwind's `sm`) are "narrow". */
const NARROW_QUERY = "(max-width: 639.98px)";

/** True on a narrow screen. The server cannot know, so it renders `false`. */
function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(NARROW_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

/**
 * About how much room the readout takes at the top left of a full screen
 * map (its size plus the gap to the edge, which can include a notch), in
 * pixels. If the pinned area is under that, the readout goes to the bottom.
 */
const READOUT_ROOM = {
  narrow: { width: 64 + 224, height: 64 + 130 },
  wide: { width: 64 + 256, height: 64 + 160 },
};

/**
 * The map page's interactive part: the dataset picker, the map with its key
 * and readout, the table of values and the sources. It is rendered on the
 * server too, so the table is in the first HTML. The map itself only starts
 * in the browser.
 *
 * Pointing at an area previews it. Clicking or tapping it, or choosing it
 * in the table, pins it, so the readout stays. Pressing Escape, clicking
 * empty map, or choosing the pinned area again unpins it.
 *
 * The full screen button expands one wrapper that holds the map, the key
 * and the readout (see `useExpandable`). In full screen on a narrow screen,
 * the key starts collapsed to a slim bar, and the readout moves to the
 * bottom if the pinned area would be under it. Once the visitor chooses to
 * hide or show the key, that choice is kept for the rest of the visit, in
 * both modes. Nothing is stored in the browser.
 */
export function MapExplorer({
  datasetId,
  values,
  sources,
}: {
  /** The registry id of the dataset to show. */
  datasetId: string;
  /** Every area's value for the period. */
  values: MapDataset;
  /** All the credits from the `sources` table, or `null` if they could not be loaded. */
  sources: SourceCredit[] | null;
}) {
  const dataset = getDataset(datasetId);
  if (!dataset) throw new Error(`Unknown dataset ${datasetId}`);

  const [hovered, setHovered] = useState<SelectedArea | null>(null);
  const [pinned, setPinned] = useState<SelectedArea | null>(null);
  const [areaCounts, setAreaCounts] = useState<Record<string, number>>({});
  // A pin belongs to one dataset. This component is not remounted when the
  // dataset changes (so the map is not recreated), so clear it here.
  const [shownDatasetId, setShownDatasetId] = useState(datasetId);
  if (shownDatasetId !== datasetId) {
    setShownDatasetId(datasetId);
    setHovered(null);
    setPinned(null);
  }
  const frameRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const expand = useExpandable(frameRef, buttonRef);
  // While the frame fills the viewport with CSS, the rest of the page is out of reach.
  const behind = expand.mode === "css";
  const narrow = useNarrowScreen();
  // `null` until the visitor chooses. Then it decides, whatever the screen.
  const [legendChoice, setLegendChoice] = useState<boolean | null>(null);
  const legendCollapsed = legendChoice ?? (expand.expanded && narrow);
  const [pinnedRect, setPinnedRect] = useState<AreaRect | null>(null);

  const shown = pinned ?? hovered;
  const numbers = useMemo(() => values.values.map((area) => area.value), [values]);
  const scale = useMemo(() => buildScale(numbers, dataset.scale), [numbers, dataset.scale]);
  // Only this dataset's sources, in the registry's order.
  const credits =
    sources === null
      ? null
      : dataset.sourceSlugs.flatMap((slug) => sources.filter((source) => source.slug === slug));
  const lowest = numbers.length ? Math.min(...numbers) : 0;
  const highest = numbers.length ? Math.max(...numbers) : 0;

  // In full screen, put the readout at the bottom if the pinned area is
  // where it would sit at the top.
  const room = narrow ? READOUT_ROOM.narrow : READOUT_ROOM.wide;
  const readoutAtBottom =
    expand.expanded &&
    pinned !== null &&
    pinnedRect !== null &&
    pinnedRect.right > 0 &&
    pinnedRect.bottom > 0 &&
    pinnedRect.left < room.width &&
    pinnedRect.top < room.height;

  const onAreaCount = useCallback((id: string, count: number) => {
    setAreaCounts((current) => (current[id] === count ? current : { ...current, [id]: count }));
  }, []);

  /** Pins an area, or unpins it if it is already pinned. `null` unpins. */
  const togglePin = useCallback((area: SelectedArea | null) => {
    setPinned((current) => (area === null || current?.code === area.code ? null : area));
  }, []);

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
      <div inert={behind}>
        <DatasetPicker selectedId={datasetId} />
      </div>

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
        data-readout={readoutAtBottom ? "bottom" : "top"}
        className="map-frame lg:relative"
      >
        <div
          role="region"
          aria-label={`Map: ${dataset.title}. The same values are in the table below.`}
          className="map-region relative h-[26rem] overflow-hidden rounded-md border border-line bg-surface lg:h-[36rem]"
        >
          <MapErrorBoundary>
            <ChoroplethMap
              datasetId={datasetId}
              boundaryUrl={dataset.map.boundaryUrl}
              dataset={values}
              scale={scale}
              highlightCode={shown?.code ?? null}
              expanded={expand.expanded}
              onToggleExpanded={expand.toggle}
              onFullscreenButton={(button) => {
                buttonRef.current = button;
              }}
              onHighlightRect={setPinnedRect}
              onHover={setHovered}
              onSelect={togglePin}
              onAreaCount={onAreaCount}
            />
          </MapErrorBoundary>
        </div>
        {/* Outside full screen this adds no box: the readout and key lay out
            as before (below the map, or over it on a wide screen). In full
            screen, it is one container inside the safe area (see map.css). */}
        <div className="map-overlays contents">
          <div
            data-testid="area-readout"
            data-empty={shown === null}
            aria-live={pinned ? "polite" : "off"}
            className="map-readout mt-3 rounded-md border border-line bg-surface p-3 lg:absolute lg:top-3 lg:left-3 lg:mt-0 lg:w-64 lg:bg-surface/95 lg:shadow-sm lg:data-[empty=true]:hidden"
          >
            <AreaReadout
              dataset={dataset}
              values={values}
              area={shown}
              pinned={pinned !== null}
            />
          </div>
          <div className="map-legend mt-3 lg:absolute lg:bottom-9 lg:left-3 lg:mt-0">
            <Legend
              scale={scale}
              heading={dataset.title}
              lowest={lowest}
              highest={highest}
              collapsed={legendCollapsed}
              onToggle={() => setLegendChoice(!legendCollapsed)}
            />
          </div>
        </div>
      </div>

      <section
        id="values-table"
        aria-label="Table of values"
        inert={behind}
        className="scroll-mt-4"
      >
        <ValuesTable
          key={datasetId}
          dataset={dataset}
          values={values}
          areaCount={areaCounts[datasetId] ?? null}
          pinned={pinned}
          onPin={togglePin}
        />
      </section>

      <div inert={behind}>
        <Sources credits={credits} />
      </div>
    </div>
  );
}
