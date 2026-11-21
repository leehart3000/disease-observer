"use client";

import { useId } from "react";
import { formatNumber } from "@/lib/map/layers";
import type { Scale } from "@/lib/map/scale";

const buttonClass =
  "min-h-9 shrink-0 cursor-pointer rounded-md px-2 text-xs underline underline-offset-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";

/**
 * The map key. Expanded, it has one swatch per colour class, each with the
 * range in words, and a swatch for areas with no figure. Collapsed, it is a
 * slim bar with a colour strip and the lowest and highest values. The
 * swatches and the strip are decoration. The text carries the meaning.
 *
 * Whether it is collapsed is decided by the parent, so the choice can last
 * for the whole page visit.
 */
export function Legend({
  scale,
  heading,
  lowest,
  highest,
  collapsed,
  onToggle,
}: {
  scale: Scale;
  heading: string;
  /** The smallest value on the map, for the collapsed bar. */
  lowest: number;
  /** The largest value on the map, for the collapsed bar. */
  highest: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const ids = useId();
  const headingId = `${ids}-heading`;
  const listId = `${ids}-list`;
  const toggle = (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={listId}
      onClick={onToggle}
      className={buttonClass}
    >
      {collapsed ? "Show legend" : "Hide legend"}
    </button>
  );

  return (
    <div className="rounded-md border border-line bg-surface/95 px-3 py-1 text-sm shadow-sm">
      {collapsed ? (
        <div
          role="group"
          aria-label={`Legend, lowest value ${formatNumber(lowest)}, highest value ${formatNumber(highest)}`}
          className="flex items-center gap-2"
        >
          <span aria-hidden="true" className="tabular-nums">
            {formatNumber(lowest)}
          </span>
          <span
            aria-hidden="true"
            className="flex h-3 w-20 overflow-hidden rounded-sm border border-line sm:w-28"
          >
            {scale.classes.map((entry) => (
              <span key={entry.label} className="flex-1" style={{ backgroundColor: entry.colour }} />
            ))}
          </span>
          <span aria-hidden="true" className="tabular-nums">
            {formatNumber(highest)}
          </span>
          {toggle}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p id={headingId} className="py-1.5 text-xs font-medium text-muted">
            {heading}
          </p>
          {toggle}
        </div>
      )}
      {/* Always in the page, so aria-controls has something to point at. */}
      <ul
        id={listId}
        hidden={collapsed}
        aria-labelledby={headingId}
        className="map-legend-list mb-1 grid gap-1"
      >
        {scale.classes.map((entry) => (
          <li key={entry.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-sm border border-line"
              style={{ backgroundColor: entry.colour }}
            />
            {entry.label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-sm border border-line bg-[#c9d0d8] dark:bg-[#3a4856]"
          />
          No data
        </li>
      </ul>
    </div>
  );
}
