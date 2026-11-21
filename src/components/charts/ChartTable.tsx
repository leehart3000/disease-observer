"use client";

import { useState } from "react";
import { getDataset } from "@/lib/datasets/registry";
import { formatNumber, formatPeriod } from "@/lib/format";
import type { DiseaseSeries } from "@/lib/series-types";

/** How many weeks the table shows until "Show all" is pressed. */
const RECENT_WEEKS = 26;

/**
 * The chart's numbers as a table, for anyone who can't or would rather not
 * use the chart: one row a week (latest first), with England and each region
 * across. It shows the latest 26 weeks, and all of them on request.
 */
export function ChartTable({ series }: { series: DiseaseSeries }) {
  const dataset = getDataset(series.datasetId);
  const [showAll, setShowAll] = useState(false);
  if (!dataset) return null;

  const total = series.periods.length;
  const shown = showAll ? total : Math.min(total, RECENT_WEEKS);
  const indexes = Array.from({ length: shown }, (_, i) => total - 1 - i);

  return (
    <details className="mt-4 rounded-md border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        View as a table
      </summary>
      <div
        role="region"
        aria-label="Table of weekly figures"
        tabIndex={0}
        className="overflow-x-auto px-4 pb-4 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="py-2 text-left text-muted">
            {dataset.columnHeading.latest}, latest week first
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-4 font-medium">
                Period
              </th>
              {series.lines.map((line) => (
                <th key={line.code} scope="col" className="py-2 pr-4 text-right font-medium">
                  {line.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indexes.map((index) => {
              const period = series.periods[index];
              return (
                <tr key={period.end} className="border-b border-line last:border-0">
                  <th scope="row" className="whitespace-nowrap py-2 pr-4 text-left font-normal">
                    {formatPeriod(dataset, period.start, period.end)}
                    {period.provisional && <span className="text-muted"> (provisional)</span>}
                  </th>
                  {series.lines.map((line) => {
                    const value = line.values[index];
                    return (
                      <td key={line.code} className="py-2 pr-4 text-right tabular-nums">
                        {value === null ? "–" : formatNumber(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!showAll && total > RECENT_WEEKS && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line px-4 text-sm hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Show all {total} weeks
          </button>
        )}
      </div>
    </details>
  );
}
