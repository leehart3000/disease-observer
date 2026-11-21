import type { Scale } from "@/lib/map/scale";

/**
 * The map key: one swatch per colour class, each with the range in words,
 * and a swatch for areas with no figure. The swatches are decoration. The
 * text carries the meaning.
 */
export function Legend({ scale, heading }: { scale: Scale; heading: string }) {
  return (
    <div className="rounded-md border border-line bg-surface/95 px-3 py-2 text-sm shadow-sm">
      <p id="map-legend-heading" className="mb-1 text-xs font-medium text-muted">
        {heading}
      </p>
      <ul aria-labelledby="map-legend-heading" className="grid gap-1">
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
