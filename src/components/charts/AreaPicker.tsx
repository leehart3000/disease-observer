"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useOptimistic, useState, useTransition } from "react";
import { parseAreaCodes } from "@/lib/datasets/url";
import type { AreaOption } from "@/lib/series-types";
import { slotColour } from "./LineChartPlot";

/** The heading for areas whose region is not known. */
const NO_REGION = "Region not known";

type Group = { region: string; areas: AreaOption[] };

/** Matches names in the order the list shows them: by name within a region. */
const byName = (a: AreaOption, b: AreaOption) => a.name.localeCompare(b.name, "en-GB");

/**
 * The areas whose name contains what was typed (ignoring case), leaving out
 * the ones already chosen. An empty text matches every area.
 */
function findMatches(options: readonly AreaOption[], text: string, chosen: ReadonlySet<string>) {
  const needle = text.trim().toLowerCase();
  return options.filter(
    (option) => !chosen.has(option.code) && option.name.toLowerCase().includes(needle),
  );
}

/**
 * Groups areas under their region, regions by name (with the areas whose
 * region is not known last) and areas by name within each.
 */
function groupByRegion(areas: readonly AreaOption[]): Group[] {
  const groups = new Map<string, AreaOption[]>();
  for (const area of areas) {
    const region = area.region ?? NO_REGION;
    groups.set(region, [...(groups.get(region) ?? []), area]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) =>
      a === NO_REGION ? 1 : b === NO_REGION ? -1 : a.localeCompare(b, "en-GB"),
    )
    .map(([region, list]) => ({ region, areas: [...list].sort(byName) }));
}

/**
 * Chooses the areas to compare on a chart, up to `limit` (one colour each).
 *
 * The chosen areas are read from the address (`?areas=`) and from nowhere
 * else, so what is shown can't drift from it, for example when Next.js
 * restores a page that was visited before. Adding, removing and clearing
 * rewrite the address through the router, and the server then loads the
 * chart's data for the new areas. The chips change at once (an optimistic
 * value that lasts only until the router has finished).
 *
 * Below a labelled search box is a scrolling list of buttons: every area,
 * under its region's heading, when the box is empty, and only the matches
 * (under the same headings) as you type. A line announces the count. The
 * buttons are in the normal tab order, and Enter in the box adds the first
 * name that starts with the text (or the first in the list). Each chosen
 * area is a chip with a "Remove" button, and "Clear" removes them all. At
 * the limit, the search and the list are replaced by a message.
 *
 * @param options - Every area that can be chosen.
 * @param placeName - The whole place the chosen areas are compared with (England).
 * @param noun - What one area is called, such as "local authority".
 */
export function AreaPicker({
  options,
  placeName,
  limit,
  noun,
  nounPlural,
}: {
  options: readonly AreaOption[];
  /** The whole place the areas are compared with, such as "England". */
  placeName: string;
  limit: number;
  noun: string;
  nounPlural: string;
}) {
  const ids = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");

  const byCode = useMemo(() => new Map(options.map((option) => [option.code, option])), [options]);
  // The same rule as the server's: codes that are not areas are dropped, and only the first few count.
  const fromUrl = useMemo(
    () =>
      parseAreaCodes(params.get("areas") ?? undefined, 10)
        .filter((code) => byCode.has(code))
        .slice(0, limit),
    [params, byCode, limit],
  );
  const [selected, setSelected] = useOptimistic(fromUrl);

  const full = selected.length >= limit;
  const matches = useMemo(
    () => findMatches(options, text, new Set(selected)),
    [options, text, selected],
  );
  const groups = useMemo(() => groupByRegion(matches), [matches]);
  const typed = text.trim() !== "";

  function choose(codes: string[]) {
    // Built from the address bar, which is always current, so nothing else in
    // the query (such as the range) is lost.
    const query = new URLSearchParams(window.location.search);
    if (codes.length > 0) query.set("areas", codes.join(","));
    else query.delete("areas");
    const queryText = query.toString().replaceAll("%2C", ",");
    startTransition(() => {
      setSelected(codes);
      router.replace(queryText ? `${pathname}?${queryText}` : pathname, { scroll: false });
    });
  }

  function add(code: string) {
    if (full || selected.includes(code)) return;
    choose([...selected, code]);
    setText("");
  }

  /** What Enter adds: the first name that starts with the text, else the first in the list. */
  function firstChoice(): AreaOption | undefined {
    const needle = text.trim().toLowerCase();
    return matches.find((option) => option.name.toLowerCase().startsWith(needle)) ?? groups[0]?.areas[0];
  }

  const countId = `${ids}-count`;
  const regionCount = groups.length;
  const countText =
    matches.length === 0
      ? `No ${nounPlural} match.`
      : typed
        ? matches.length === 1
          ? "1 match."
          : `${matches.length} matches in ${regionCount} ${regionCount === 1 ? "region" : "regions"}.`
        : `${matches.length} ${nounPlural} in ${regionCount} ${regionCount === 1 ? "region" : "regions"}.`;

  return (
    <section aria-labelledby={`${ids}-heading`} className="mt-4">
      <h2 id={`${ids}-heading`} className="mb-2 text-sm font-medium text-muted">
        Compare with {placeName}: choose up to {limit} {nounPlural}.
      </h2>

      {selected.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label={`Chosen ${nounPlural}`}>
          {selected.map((code, index) => {
            const name = byCode.get(code)?.name ?? code;
            return (
              <li
                key={code}
                className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface pl-3"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-[3px] w-5 shrink-0 rounded-full"
                  style={{ background: slotColour(index + 1) }}
                />
                <span className="font-medium">{name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => choose(selected.filter((entry) => entry !== code))}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm underline underline-offset-4 hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                >
                  Remove
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => choose([])}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm underline underline-offset-4 hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
            >
              Clear
            </button>
          </li>
        </ul>
      ) : null}

      {full ? (
        <p className="text-sm text-muted">
          {limit} {nounPlural} are chosen, the most the chart can show. Remove one to choose another.
        </p>
      ) : (
        <div className="grid max-w-md gap-1">
          <label htmlFor={`${ids}-search`} className="text-sm font-medium">
            Find a {noun}
          </label>
          <input
            id={`${ids}-search`}
            type="search"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              const first = firstChoice();
              if (event.key === "Enter" && typed && first) {
                event.preventDefault();
                add(first.code);
              }
            }}
            aria-describedby={countId}
            className="min-h-11 rounded-md border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <p id={countId} role="status" className="text-sm text-muted">
            {countText}
          </p>
          {matches.length > 0 ? (
            <div
              role="group"
              aria-label={`${nounPlural[0].toUpperCase()}${nounPlural.slice(1)} by region`}
              // `relative` keeps the buttons' hidden "Add " text (absolutely positioned) inside the
              // panel: without it, each one sits outside the scroller and makes the page as tall as the list.
              className="relative max-h-72 overflow-y-auto rounded-md border border-line bg-surface"
            >
              {groups.map((group, index) => (
                <div key={group.region} role="group" aria-labelledby={`${ids}-region-${index}`}>
                  <h3
                    id={`${ids}-region-${index}`}
                    className="sticky top-0 border-b border-line bg-paper px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase"
                  >
                    {group.region}
                  </h3>
                  <ul>
                    {group.areas.map((option) => (
                      <li key={option.code}>
                        <button
                          type="button"
                          onClick={() => add(option.code)}
                          className="flex min-h-11 w-full cursor-pointer items-center px-3 text-left hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                        >
                          <span className="sr-only">Add </span>
                          {option.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
