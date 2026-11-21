"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp, dayToMs, linePath, monthTicks, nearestIndex, yAxis } from "@/lib/chart-math";
import { getDataset } from "@/lib/datasets/registry";
import { formatNumber, formatPeriod, formatValue } from "@/lib/format";
import type { DiseaseSeries } from "@/lib/series-types";
import { ChartTable } from "./ChartTable";

/** Room around the plot for the axis labels. */
const MARGIN = { top: 10, right: 12, bottom: 26, left: 44 };
/** The most regions that can be highlighted at once. Each has its own colour. */
const MAX_HIGHLIGHTED = 3;
/** The size used for the first render, on the server and in the browser. */
const DEFAULT_SIZE = { w: 640, h: 320 };

/** A region the visitor has picked, and the colour slot (1 to 3) it uses. */
type Picked = { code: string; slot: number };

const slotColour = (slot: number) => `var(--chart-${slot})`;

/**
 * England and the UKHSA regions over time, as a hand-built SVG line chart.
 *
 * England is a thick line in the text colour and the regions are thin
 * muted lines, so colour never carries identity on its own. Pressing a
 * region in the legend highlights it (up to three, each in its own colour).
 * Pointing at or touching the chart moves a marker and shows the values for
 * that week. The chart is also a keyboard slider (arrow keys one week, Page
 * Up and Page Down four, Home and End the ends), and the same numbers are
 * in a table under it.
 *
 * The lines and axes are in the server-rendered HTML. After it loads, the
 * chart measures its box and draws itself at that size.
 */
export function LineChart({ series, diseaseName }: { series: DiseaseSeries; diseaseName: string }) {
  const dataset = getDataset(series.datasetId);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [active, setActive] = useState(series.periods.length - 1);

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

  const geometry = useMemo(() => {
    const times = series.periods.map((period) => dayToMs(period.end));
    const plotW = size.w - MARGIN.left - MARGIN.right;
    const plotH = size.h - MARGIN.top - MARGIN.bottom;
    const allValues = series.lines.flatMap((line) => line.values.filter((v) => v !== null));
    const axis = yAxis(Math.max(0, ...allValues));
    const span = times[times.length - 1] - times[0] || 1;
    const x = (ms: number) => MARGIN.left + ((ms - times[0]) / span) * plotW;
    const y = (value: number) => MARGIN.top + plotH - (value / axis.max) * plotH;
    return {
      times,
      plotH,
      axis,
      x,
      y,
      xs: times.map(x),
      xTicks: monthTicks(times[0], times[times.length - 1], Math.floor(plotW / 80)),
    };
  }, [series, size]);

  if (!dataset || !england) return null;

  const pathOf = (values: Array<number | null>) =>
    linePath(values.map((value, index) => [geometry.xs[index], value === null ? null : geometry.y(value)]));

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

  const first = series.periods[0];
  const latestValue = england.values[last];
  const summary =
    `${diseaseName}, ${dataset.columnHeading.latest.toLowerCase()}, weekly, England and UKHSA regions, ` +
    `${new Date(`${first.end}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })} to ` +
    `${new Date(`${series.periods[last].end}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}.` +
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
    setActive(nearestIndex(geometry.xs, event.clientX - rect.left));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -4, PageUp: 4 };
    let next: number | undefined;
    if (event.key in steps) next = active + steps[event.key];
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === undefined) return;
    event.preventDefault();
    setActive(clamp(next, 0, last));
  }

  const markerX = geometry.xs[active];
  const pickedLines = picked.flatMap(({ code, slot }) => {
    const line = regions.find((entry) => entry.code === code);
    return line ? [{ line, slot }] : [];
  });
  const pickedCodes = new Set(picked.map((entry) => entry.code));
  const full = picked.length >= MAX_HIGHLIGHTED;
  const axisText = { fill: "var(--muted)", fontSize: 11 } as const;

  return (
    <figure data-testid="line-chart">
      <figcaption className="text-sm text-muted">{dataset.columnHeading.latest}, weekly</figcaption>

      <div className="mt-3">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Places on the chart">
          <li className="flex min-h-11 items-center gap-2">
            <span aria-hidden="true" className="inline-block h-[3px] w-5 rounded-full bg-ink" />
            England
          </li>
          {regions.map((line) => {
            const pick = picked.find((entry) => entry.code === line.code);
            return (
              <li key={line.code}>
                <button
                  type="button"
                  aria-pressed={pick !== undefined}
                  disabled={full && !pick}
                  onClick={() => togglePicked(line.code)}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:font-medium"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-5 rounded-full bg-muted"
                    style={pick ? { background: slotColour(pick.slot), height: 3 } : undefined}
                  />
                  {line.name}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">
          {full ? "Three regions are highlighted, the most the chart can show. Unselect one to pick another." : "Pick up to three regions to highlight."}
        </p>
      </div>

      <p className="mt-3 min-h-12 text-sm" data-testid="chart-readout">
        {describe(active)}
      </p>

      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label={`${summary} Use the left and right arrow keys to move between weeks.`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={active}
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
          <path
            d={pathOf(england.values)}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

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

      <ChartTable series={series} />
    </figure>
  );
}
