"use client";

import { useId, useState } from "react";
import { fieldClass, PAGE_SIZES, PageControls, type PageSize } from "@/components/PageControls";
import { getDataset } from "@/lib/datasets/registry";
import { formatNumber, formatPeriod } from "@/lib/format";
import type { DiseaseSeries } from "@/lib/series-types";

/**
 * The chart's numbers as a table, for anyone who can't or would rather not
 * use the chart: one row a week, newest first, with England and each region
 * across. It covers the same weeks as the chart (from `from` to the latest)
 * and is paged like the map's table: 25 rows by default, then 50, 100 or all.
 *
 * It is a disclosure: the summary has a chevron that turns when it is open.
 * The chevron is decoration, so the summary reads as plain text.
 */
export function ChartTable({ series, from }: { series: DiseaseSeries; from: number }) {
  const ids = useId();
  const dataset = getDataset(series.datasetId);
  const [pageSize, setPageSize] = useState<PageSize>("25");
  const [requestedPage, setRequestedPage] = useState(1);
  if (!dataset) return null;

  // Newest first.
  const indexes = Array.from({ length: series.periods.length - from }, (_, i) => series.periods.length - 1 - i);
  const size = pageSize === "all" ? Math.max(indexes.length, 1) : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(indexes.length / size));
  const page = Math.min(requestedPage, pageCount);
  const first = (page - 1) * size;
  const rows = indexes.slice(first, first + size);

  return (
    <details className="group mt-4 rounded-md border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
        View data table
      </summary>
      <div className="px-4 pb-4">
        <div className="mb-3 grid gap-1">
          <label htmlFor={`${ids}-size`} className="text-sm font-medium text-muted">
            Rows per page
          </label>
          <select
            id={`${ids}-size`}
            value={pageSize}
            onChange={(event) => {
              setPageSize(event.target.value as PageSize);
              setRequestedPage(1);
            }}
            className={`${fieldClass} w-fit`}
          >
            {PAGE_SIZES.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All" : option}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* The only live region of the table: the result count is announced once. */}
          <p role="status" className="text-sm text-muted">
            {`Showing ${first + 1} to ${first + rows.length} of ${indexes.length} weeks`}
          </p>
          <PageControls
            label="Data table pages (top)"
            page={page}
            pageCount={pageCount}
            onPage={setRequestedPage}
          />
        </div>

        <div
          role="region"
          aria-label="Table of weekly figures"
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand"
        >
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="py-2 text-left text-muted">
              {dataset.columnHeading.latest}, newest week first
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
              {rows.map((index) => {
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
        </div>

        <div className="mt-3">
          <PageControls
            label="Data table pages (bottom)"
            page={page}
            pageCount={pageCount}
            onPage={setRequestedPage}
          />
        </div>
      </div>
    </details>
  );
}
