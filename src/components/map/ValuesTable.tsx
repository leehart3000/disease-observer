"use client";

import { useId, useMemo, useState } from "react";
import { formatNumber, formatPeriod, LAYERS } from "@/lib/map/layers";
import type { LayerKey, MapDataset } from "@/lib/map/types";
import type { SelectedArea } from "./ChoroplethMap";

type SortKey = "name" | "value";
type SortDirection = "ascending" | "descending";

const PAGE_SIZES = ["25", "50", "100", "all"] as const;
type PageSize = (typeof PAGE_SIZES)[number];

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-3 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

const fieldClass =
  "min-h-11 rounded-md border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * Previous and Next buttons with the page number. It is used above and
 * below the table, and both copies show the same page. It renders nothing
 * when there is only one page. It is not a live region: the result count
 * above the table is the one that is announced.
 */
function PageControls({
  label,
  page,
  pageCount,
  onPage,
}: {
  label: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm text-muted">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

/**
 * The same values as the map, as a table that can be searched, sorted and
 * paged. It is the way to read the figures with a keyboard or a screen
 * reader, and a keyboard user can pin an area from it. The server renders
 * the first 25 rows into the page's HTML.
 *
 * From top to bottom: the search box and page size, the result count with
 * the page controls, the table, then the page controls again.
 */
export function ValuesTable({
  layer,
  dataset,
  areaCount,
  pinned,
  onPin,
}: {
  layer: LayerKey;
  dataset: MapDataset;
  /** How many areas the map draws for this layer, once known. */
  areaCount: number | null;
  /** The pinned area, if any. */
  pinned: SelectedArea | null;
  /** Called with an area to pin it (or unpin it, if it is already pinned). */
  onPin: (area: SelectedArea) => void;
}) {
  const config = LAYERS[layer];
  const ids = useId();
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
    { key: "value", label: config.valueHeading, numeric: true },
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

      {anyProvisional ? (
        <p className="mb-2 text-sm text-muted">Provisional figures may still change.</p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="px-3 py-3 text-left">
            <span className="block font-medium">{config.title}</span>
            <span className="block text-muted">
              {formatPeriod(layer, dataset.periodStart, dataset.periodEnd)}
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
            </tr>
          </thead>
          <tbody>
            {rows.map((area) => {
              const isPinned = pinned?.code === area.code;
              return (
                <tr
                  key={area.code}
                  className={`border-b border-line last:border-b-0 ${isPinned ? "bg-brand/15" : ""}`}
                >
                  <th scope="row" className="p-0 font-normal">
                    <div className="flex items-center gap-2 pr-3">
                      <button
                        type="button"
                        aria-pressed={isPinned}
                        aria-label={
                          isPinned
                            ? `Unpin ${area.name} from the map`
                            : `Pin ${area.name} on the map`
                        }
                        onClick={() => onPin({ code: area.code, name: area.name })}
                        className="min-h-9 cursor-pointer px-3 py-2 text-left hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                      >
                        {area.name}
                      </button>
                      {isPinned ? (
                        <span className="rounded border border-brand bg-surface px-1.5 py-0.5 text-xs font-medium">
                          Pinned
                        </span>
                      ) : null}
                    </div>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {area.provisional ? (
                      <span className="mr-2 rounded border border-line bg-paper px-1.5 py-0.5 text-xs">
                        Provisional
                      </span>
                    ) : null}
                    {formatNumber(area.value)}
                  </td>
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
