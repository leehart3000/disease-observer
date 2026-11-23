"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { fieldClass, PAGE_SIZES, PageControls, type PageSize } from "@/components/PageControls";
import { chartAreaHref } from "@/lib/datasets/routes";
import type { DatasetDef, PeriodChoice } from "@/lib/datasets/types";
import { columnHeading, formatCoverage, formatNumber, formatPeriod } from "@/lib/format";
import type { MapDataset } from "@/lib/map/types";
import type { SelectedArea } from "./map/ChoroplethMap";

type SortKey = "name" | "value";
type SortDirection = "ascending" | "descending";

/**
 * What choosing an area in the table does.
 *
 * - `pin`: on the map page, the area's name is a button that pins it on the
 *   map (and unpins it).
 * - `link`: on the table page, there is no map, so each row has a "View on
 *   map" link to the map page with that area pinned. Rows for the areas in
 *   `selected` (from `?areas=` in the address) are highlighted.
 */
export type RowAction =
  | { kind: "pin"; pinned: SelectedArea | null; onPin: (area: SelectedArea) => void }
  | { kind: "link"; mapPath: string; selected: readonly string[] };

/** A map pin. It is decoration: the button it is in has its own name. */
function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" fill={filled ? "var(--surface)" : "none"} />
    </svg>
  );
}

/** The "View on map" link of a row on the table page: the map page with this area pinned. */
function ViewOnMapLink({
  mapPath,
  period,
  area,
}: {
  mapPath: string;
  /** The period of the table, so the map shows the same one. */
  period: PeriodChoice;
  area: { code: string; name: string };
}) {
  const query = new URLSearchParams();
  if (period !== "latest") query.set("p", period);
  query.set("areas", area.code);
  return (
    <Link
      href={`${mapPath}?${query}`}
      // The visible words "View on map" start the name, so the two agree (WCAG 2.5.3).
      aria-label={`View on map: ${area.name}`}
      className="group inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-2 text-brand underline underline-offset-4 hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
    >
      <PinIcon filled={false} />
      View on map
    </Link>
  );
}

/** The "Chart" link of a row on the table page: the chart page with this area chosen. */
function ChartLink({ href, area }: { href: string; area: { name: string } }) {
  return (
    <Link
      href={href}
      aria-label={`Chart ${area.name}`}
      className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-2 text-brand underline underline-offset-4 hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 shrink-0"
      >
        <path d="m3 17 6-6 4 4 8-8" />
      </svg>
      Chart
    </Link>
  );
}

/**
 * The values of a dataset as a table that can be searched, sorted and paged.
 * It is the way to read the figures with a keyboard or a screen reader. The
 * server renders the first 25 rows into the page's HTML.
 *
 * From top to bottom: the search box and page size, the result count with
 * the page controls, a line saying what choosing an area does (on the map
 * page), the table, then the page controls again.
 */
export function ValuesTable({
  dataset: config,
  values: dataset,
  areaCount,
  action,
}: {
  /** The dataset's registry entry: its title and column heading. */
  dataset: DatasetDef;
  /** The values to show. */
  values: MapDataset;
  /** How many areas the map draws for this dataset, once known (`null` where there is no map). */
  areaCount: number | null;
  /** What choosing an area does. */
  action: RowAction;
}) {
  const ids = useId();
  // A dataset whose chart compares areas has a "Chart" link in each row.
  const hasChartLinks = chartAreaHref(config, "") !== null;
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "value",
    direction: "descending",
  });
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>("25");
  const [requestedPage, setRequestedPage] = useState(1);

  const matching = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en-GB");
    return needle
      ? dataset.values.filter((area) => area.name.toLocaleLowerCase("en-GB").includes(needle))
      : dataset.values;
  }, [dataset, query]);

  const sorted = useMemo(() => {
    const factor = sort.direction === "ascending" ? 1 : -1;
    return [...matching].sort((a, b) => {
      const result =
        sort.key === "value" ? a.value - b.value : a.name.localeCompare(b.name, "en-GB");
      return result * factor || a.name.localeCompare(b.name, "en-GB");
    });
  }, [matching, sort]);

  const size = pageSize === "all" ? Math.max(sorted.length, 1) : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(sorted.length / size));
  const page = Math.min(requestedPage, pageCount);
  const first = (page - 1) * size;
  const rows = sorted.slice(first, first + size);

  function toggleSort(key: SortKey) {
    setRequestedPage(1);
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "ascending" ? "descending" : "ascending" }
        : { key, direction: key === "value" ? "descending" : "ascending" },
    );
  }

  const anyProvisional = dataset.values.some((area) => area.provisional);
  const withoutFigure = areaCount === null ? 0 : areaCount - dataset.values.length;
  const filtered = query.trim() !== "";
  const columns: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: "name", label: "Area", numeric: false },
    { key: "value", label: columnHeading(config, dataset.period), numeric: true },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="grid gap-1">
          <label htmlFor={`${ids}-search`} className="text-sm font-medium text-muted">
            Search table by area name
          </label>
          <input
            id={`${ids}-search`}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setRequestedPage(1);
            }}
            className={`${fieldClass} w-full sm:w-72`}
          />
        </div>
        <div className="grid gap-1">
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
            className={fieldClass}
          >
            {PAGE_SIZES.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All" : option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* The only live region of the table: the result count is announced once. */}
        <p role="status" className="text-sm text-muted">
          {sorted.length === 0
            ? `No areas match “${query.trim()}”.`
            : `Showing ${first + 1} to ${first + rows.length} of ${sorted.length}${filtered ? ` matching “${query.trim()}”` : ""}`}
        </p>
        <PageControls label="Table pages (top)" page={page} pageCount={pageCount} onPage={setRequestedPage} />
      </div>

      {action.kind === "pin" ? (
        <p className="mb-2 text-sm text-muted" data-testid="table-instruction">
          Select an area to pin it on the map.
        </p>
      ) : null}
      {anyProvisional ? (
        <p className="mb-2 text-sm text-muted">Provisional figures may still change.</p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="px-3 py-3 text-left">
            <span className="block font-medium">{config.title}</span>
            <span className="block text-muted">
              {formatPeriod(config, dataset.periodStart, dataset.periodEnd, dataset.period)}
            </span>
          </caption>
          <thead>
            <tr className="border-y border-line bg-paper">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sort.key === column.key ? sort.direction : "none"}
                  className={`p-0 font-medium ${column.numeric ? "text-right" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-1 px-3 hover:bg-line/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${column.numeric ? "justify-end text-right" : ""}`}
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
              {action.kind === "link" ? (
                <th scope="col" className="hidden px-3 font-medium sm:table-cell">
                  Map
                </th>
              ) : null}
              {action.kind === "link" && hasChartLinks ? (
                <th scope="col" className="hidden px-3 font-medium sm:table-cell">
                  Chart
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((area) => {
              const highlighted =
                action.kind === "pin"
                  ? action.pinned?.code === area.code
                  : action.selected.includes(area.code);
              return (
                <tr
                  key={area.code}
                  data-selected={highlighted}
                  className={`border-b border-line last:border-b-0 ${highlighted ? "bg-brand/15" : ""}`}
                >
                  <th scope="row" className="p-0 font-normal">
                    {action.kind === "pin" ? (
                      <div className="flex items-center gap-2 pr-3">
                        <button
                          type="button"
                          aria-pressed={highlighted}
                          aria-label={
                            highlighted
                              ? `Unpin ${area.name} from the map`
                              : `Pin ${area.name} on the map`
                          }
                          onClick={() => action.onPin({ code: area.code, name: area.name })}
                          className="group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-brand/10 hover:text-brand focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                        >
                          <span
                            className={`inline-flex ${highlighted ? "text-brand" : "text-muted group-hover:text-brand"}`}
                          >
                            <PinIcon filled={highlighted} />
                          </span>
                          {area.name}
                        </button>
                        {highlighted ? (
                          <span className="rounded border border-brand bg-surface px-1.5 py-0.5 text-xs font-medium">
                            Pinned
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {area.name}
                          {highlighted ? (
                            <span className="rounded border border-brand bg-surface px-1.5 py-0.5 text-xs font-medium">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        {/* On a narrow screen there is no Map column: the link goes under the name. */}
                        <div className="-ml-2 flex flex-wrap sm:hidden">
                          <ViewOnMapLink mapPath={action.mapPath} period={dataset.period} area={area} />
                          {chartAreaHref(config, area.code) ? (
                            <ChartLink href={chartAreaHref(config, area.code)!} area={area} />
                          ) : null}
                        </div>
                      </div>
                    )}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {area.provisional ? (
                      <span className="mr-2 rounded border border-line bg-paper px-1.5 py-0.5 text-xs">
                        Provisional
                      </span>
                    ) : null}
                    {formatNumber(area.value, config.decimals)}
                    {formatCoverage(area.weeks, dataset.weeksExpected) ? (
                      <span className="block text-xs text-muted">
                        {formatCoverage(area.weeks, dataset.weeksExpected)}
                      </span>
                    ) : null}
                  </td>
                  {action.kind === "link" ? (
                    <td className="hidden px-3 py-0 sm:table-cell">
                      <ViewOnMapLink mapPath={action.mapPath} period={dataset.period} area={area} />
                    </td>
                  ) : null}
                  {action.kind === "link" && hasChartLinks ? (
                    <td className="hidden px-3 py-0 sm:table-cell">
                      <ChartLink href={chartAreaHref(config, area.code)!} area={area} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <PageControls label="Table pages (bottom)" page={page} pageCount={pageCount} onPage={setRequestedPage} />
      </div>

      {withoutFigure > 0 ? (
        <p className="mt-3 text-sm text-muted">
          {withoutFigure} {withoutFigure === 1 ? "area" : "areas"} on the map{" "}
          {withoutFigure === 1 ? "has" : "have"} no figure for this period.
        </p>
      ) : null}
    </div>
  );
}
