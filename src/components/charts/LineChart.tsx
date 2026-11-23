"use client";

import { useState } from "react";
import { chartAreas, getDataset, getDisease } from "@/lib/datasets/registry";
import type { DiseaseSeries } from "@/lib/series-types";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import { LineChartPlot, slotColour, type ChartRange, type Highlight } from "./LineChartPlot";
import { useChartRange } from "./useChartRange";

/** The most regions that can be highlighted at once. Each has its own colour. */
const MAX_HIGHLIGHTED = 3;

/**
 * A dataset's whole place (England) and the areas of its disease's chart (the
 * UKHSA regions) over time, as a hand-built SVG line chart.
 *
 * This is the controls (the range and the area checkboxes) around
 * `LineChartPlot`, which does the drawing. Ticking an area highlights it
 * on top of the whole place (up to three, each in its own colour). The range
 * is the last 12 months or the whole series.
 *
 * @param sinceLabel - The text of the "whole series" range, such as "Since 2023".
 * @param rangeInUrl - True to keep the range only in the address, as
 *   `?range=all` (left out for the last 12 months). See `useChartRange`.
 */
export function LineChart({
  series,
  diseaseName,
  sinceLabel,
  rangeInUrl = false,
}: {
  series: DiseaseSeries;
  diseaseName: string;
  sinceLabel: string;
  rangeInUrl?: boolean;
}) {
  const dataset = getDataset(series.datasetId);
  const disease = getDisease(series.diseaseSlug);
  // The areas drawn with the place (the regions), or none if it is drawn alone.
  const areas = dataset ? chartAreas(dataset) : null;
  const [picked, setPicked] = useState<Highlight[]>([]);
  const [range, chooseRange] = useChartRange(rangeInUrl);

  // The whole place first (England), then its areas.
  const [whole, ...regions] = series.lines;
  if (!dataset || !disease || !whole) return null;

  function togglePicked(code: string) {
    setPicked((old) => {
      if (old.some((entry) => entry.code === code)) return old.filter((entry) => entry.code !== code);
      if (old.length >= MAX_HIGHLIGHTED) return old;
      const used = new Set(old.map((entry) => entry.slot));
      const slot = [1, 2, 3].find((candidate) => !used.has(candidate)) ?? 1;
      return [...old, { code, slot }];
    });
  }

  const full = picked.length >= MAX_HIGHLIGHTED;
  const ranges: Array<{ value: ChartRange; label: string }> = [
    { value: "12m", label: "Last 12 months" },
    { value: "all", label: sinceLabel },
  ];

  return (
    <figure data-testid="line-chart">
      <figcaption className="text-sm text-muted">{dataset.columnHeading.latest}, weekly</figcaption>

      <SegmentedChoice
        legend="Time range"
        options={ranges}
        value={range}
        onChange={chooseRange}
        className="mt-3"
      />

      {areas ? (
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-muted">
          Pick up to three {areas.noun} to highlight.
        </legend>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:flex sm:flex-wrap sm:gap-x-5">
          <li className="flex min-h-11 items-center gap-3">
            <span aria-hidden="true" className="inline-block h-[3px] w-5 shrink-0 rounded-full bg-ink" />
            {dataset.place.name}
          </li>
          {regions.map((line) => {
            const pick = picked.find((entry) => entry.code === line.code);
            return (
              <li key={line.code}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand">
                  <input
                    type="checkbox"
                    checked={pick !== undefined}
                    disabled={full && !pick}
                    onChange={() => togglePicked(line.code)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center rounded-sm border-2 border-muted bg-surface"
                    style={
                      pick
                        ? { background: slotColour(pick.slot), borderColor: slotColour(pick.slot) }
                        : undefined
                    }
                  >
                    {pick && (
                      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    )}
                  </span>
                  <span className={pick ? "font-medium" : undefined}>{line.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {full && (
          <p className="mt-1 text-sm text-muted">
            Three {areas.noun} are highlighted, the most the chart can show. Untick one to pick another.
          </p>
        )}
      </fieldset>
      ) : null}

      <LineChartPlot
        series={series}
        diseaseName={diseaseName}
        highlights={picked}
        range={range}
        scope={areas ? `${dataset.place.name} and ${areas.label}` : dataset.place.name}
      />
    </figure>
  );
}
