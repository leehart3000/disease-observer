"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { clamp, dayToMs, linePath, monthTicks, nearestIndex, yAxis } from "@/lib/chart-math";
import { getDataset } from "@/lib/datasets/registry";
import { formatNumber, formatPeriod, formatValue } from "@/lib/format";
import type { DiseaseSeries } from "@/lib/series-types";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import { ChartTable } from "./ChartTable";

/** Room around the plot for the axis labels. */
const MARGIN = { top: 10, right: 12, bottom: 26, left: 44 };
/** The most regions that can be highlighted at once. Each has its own colour. */
const MAX_HIGHLIGHTED = 3;
/** The size used for the first render, on the server and in the browser. */
const DEFAULT_SIZE = { w: 640, h: 320 };

/** A region the visitor has picked, and the colour slot (1 to 3) it uses. */
type Picked = { code: string; slot: number };
type Range = "12m" | "all";

const slotColour = (slot: number) => `var(--chart-${slot})`;

/** The index of the first week of the last 12 months, counting back from the latest week. */
function firstIndexOfLastYear(ends: readonly string[]): number {
  const latest = new Date(`${ends[ends.length - 1]}T00:00:00Z`);
  latest.setUTCFullYear(latest.getUTCFullYear() - 1);
  const cutoff = latest.toISOString().slice(0, 10);
  const index = ends.findIndex((end) => end > cutoff);
  return index === -1 ? 0 : index;
}

/** The longest-day format used in the chart's description: "November 2026". */
function monthAndYear(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * England and the UKHSA regions over time, as a hand-built SVG line chart.
 *
 * England is a thick line in the text colour and the regions are thin
 * muted lines, so colour never carries identity on its own. Ticking a
 * region in the legend highlights it on top of England (up to three, each
 * in its own colour). The range is the last 12 months or the whole series.
 * Pointing at or touching the chart moves a marker and shows the values for
 * that week. The chart is also a keyboard slider (arrow keys one week, Page
 * Up and Page Down four, Home and End the ends), and the same numbers are
 * in a table under it.
 *
 * The lines and axes are in the server-rendered HTML. After it loads, the
 * chart measures its box and draws itself at that size.
 *
 * @param sinceLabel - The text of the "whole series" range, such as "Since 2023".
 */
export function LineChart({
  series,
  diseaseName,
  sinceLabel,
}: {
  series: DiseaseSeries;
  diseaseName: string;
  sinceLabel: string;
}) {
  const dataset = getDataset(series.datasetId);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [range, setRange] = useState<Range>("12m");
  const [requestedActive, setRequestedActive] = useState(series.periods.length - 1);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w > 0 && h > 0) setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const [england, ...regions] = series.lines;
  const last = series.periods.length - 1;
  // The first week on the chart. The y axis, the x axis and the table follow it.
  const from = useMemo(
    () => (range === "all" ? 0 : firstIndexOfLastYear(series.periods.map((period) => period.end))),
    [range, series],
  );
  const active = clamp(requestedActive, from, last);

  const geometry = useMemo(() => {
    const times = series.periods.slice(from).map((period) => dayToMs(period.end));
    const plotW = size.w - MARGIN.left - MARGIN.right;
    const plotH = size.h - MARGIN.top - MARGIN.bottom;
    const allValues = series.lines.flatMap((line) =>
      line.values.slice(from).filter((value) => value !== null),
    );
    const axis = yAxis(Math.max(0, ...allValues));
    const span = times[times.length - 1] - times[0] || 1;
    const x = (ms: number) => MARGIN.left + ((ms - times[0]) / span) * plotW;
    const y = (value: number) => MARGIN.top + plotH - (value / axis.max) * plotH;
    return {
      plotH,
      axis,
      x,
      y,
      xs: times.map(x),
      xTicks: monthTicks(times[0], times[times.length - 1], Math.floor(plotW / 80)),
    };
  }, [series, size, from]);

  if (!dataset || !england) return null;

  const pathOf = (values: Array<number | null>) =>
    linePath(
      values
        .slice(from)
        .map((value, index) => [geometry.xs[index], value === null ? null : geometry.y(value)]),
    );

  /** The sentence for one week: its period, England's value and the picked regions'. */
  function describe(index: number): string {
    const period = series.periods[index];
    const parts = [england, ...picked.map(({ code }) => regions.find((line) => line.code === code))]
      .filter((line) => line !== undefined)
      .map((line) => {
        const value = line.values[index];
        return `${line.name} ${value === null ? "no figure" : formatValue(dataset!, value)}`;
      });
    const provisional = period.provisional ? " (provisional)" : "";
    return `${formatPeriod(dataset!, period.start, period.end)}${provisional}: ${parts.join(", ")}`;
  }

  const latestValue = england.values[last];
  const summary =
    `${diseaseName}, ${dataset.columnHeading.latest.toLowerCase()}, weekly, England and UKHSA regions, ` +
    `${monthAndYear(series.periods[from].end)} to ${monthAndYear(series.periods[last].end)}.` +
    (latestValue === null ? "" : ` Latest ${formatValue(dataset, latestValue)} for England.`);

  function togglePicked(code: string) {
    setPicked((old) => {
      if (old.some((entry) => entry.code === code)) return old.filter((entry) => entry.code !== code);
      if (old.length >= MAX_HIGHLIGHTED) return old;
      const used = new Set(old.map((entry) => entry.slot));
      const slot = [1, 2, 3].find((candidate) => !used.has(candidate)) ?? 1;
      return [...old, { code, slot }];
    });
  }

  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setRequestedActive(from + nearestIndex(geometry.xs, event.clientX - rect.left));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -4, PageUp: 4 };
    let next: number | undefined;
    if (event.key in steps) next = active + steps[event.key];
    else if (event.key === "Home") next = from;
    else if (event.key === "End") next = last;
    if (next === undefined) return;
    event.preventDefault();
    setRequestedActive(clamp(next, from, last));
  }

  const markerX = geometry.xs[active - from];
  const pickedLines = picked.flatMap(({ code, slot }) => {
    const line = regions.find((entry) => entry.code === code);
    return line ? [{ line, slot }] : [];
  });
  const pickedCodes = new Set(picked.map((entry) => entry.code));
  const full = picked.length >= MAX_HIGHLIGHTED;
  const axisText = { fill: "var(--muted)", fontSize: 11 } as const;
  const ranges: Array<{ value: Range; label: string }> = [
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
        onChange={setRange}
        className="mt-3"
      />

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-muted">
          Pick up to three regions to highlight.
        </legend>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:flex sm:flex-wrap sm:gap-x-5">
          <li className="flex min-h-11 items-center gap-3">
            <span aria-hidden="true" className="inline-block h-[3px] w-5 shrink-0 rounded-full bg-ink" />
            England
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
            Three regions are highlighted, the most the chart can show. Untick one to pick another.
          </p>
        )}
      </fieldset>

      <p className="mt-3 min-h-12 text-sm" data-testid="chart-readout">
        {describe(active)}
      </p>

      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label={`${summary} Use the left and right arrow keys to move between weeks.`}
        aria-valuemin={0}
        aria-valuemax={last - from}
        aria-valuenow={active - from}
        aria-valuetext={describe(active)}
        onKeyDown={onKeyDown}
        onPointerDown={moveTo}
        onPointerMove={moveTo}
        className="aspect-[4/3] w-full cursor-crosshair touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:aspect-[2/1]"
      >
        <svg
          viewBox={`0 0 ${size.w} ${size.h}`}
          width={size.w}
          height={size.h}
          aria-hidden="true"
          focusable="false"
          className="block max-w-full"
        >
          {geometry.axis.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={size.w - MARGIN.right}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={MARGIN.left - 6} y={geometry.y(tick)} textAnchor="end" dominantBaseline="middle" style={axisText}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {geometry.xTicks.map((tick) => (
            <text
              key={tick.ms}
              x={geometry.x(tick.ms)}
              y={size.h - 6}
              textAnchor="middle"
              style={axisText}
            >
              {tick.label}
            </text>
          ))}

          {/* Drawn from the back to the front: muted regions, England, then the highlighted regions. */}
          {regions
            .filter((line) => !pickedCodes.has(line.code))
            .map((line) => (
              <path
                key={line.code}
                d={pathOf(line.values)}
                fill="none"
                stroke="var(--muted)"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeLinejoin="round"
              />
            ))}
          <path
            d={pathOf(england.values)}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pickedLines.map(({ line, slot }) => (
            <path
              key={line.code}
              d={pathOf(line.values)}
              fill="none"
              stroke={slotColour(slot)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          <line
            x1={markerX}
            x2={markerX}
            y1={MARGIN.top}
            y2={MARGIN.top + geometry.plotH}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {[{ line: england, colour: "var(--ink)" }, ...pickedLines.map(({ line, slot }) => ({ line, colour: slotColour(slot) }))].map(
            ({ line, colour }) => {
              const value = line.values[active];
              return value === null ? null : (
                <circle
                  key={line.code}
                  cx={markerX}
                  cy={geometry.y(value)}
                  r={4.5}
                  fill={colour}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              );
            },
          )}
        </svg>
      </div>

      <ChartTable series={series} from={from} />
    </figure>
  );
}
