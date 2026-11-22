"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { AreaOption } from "@/lib/series-types";
import { slotColour } from "./LineChartPlot";

/** The most names shown at once in the list of matches. */
const MAX_MATCHES = 8;

/**
 * The matches for what was typed: names that start with it first, then names
 * that contain it, ignoring case and any areas already chosen. `total` is
 * how many there are before the list is cut to `MAX_MATCHES`.
 */
function findMatches(options: readonly AreaOption[], text: string, chosen: ReadonlySet<string>) {
  const needle = text.trim().toLowerCase();
  if (needle === "") return { shown: [], total: 0 };
  const starts: AreaOption[] = [];
  const contains: AreaOption[] = [];
  for (const option of options) {
    if (chosen.has(option.code)) continue;
    const name = option.name.toLowerCase();
    if (name.startsWith(needle)) starts.push(option);
    else if (name.includes(needle)) contains.push(option);
  }
  const all = [...starts, ...contains];
  return { shown: all.slice(0, MAX_MATCHES), total: all.length };
}

/**
 * Chooses the areas to compare on a chart, up to `limit` (one colour each).
 *
 * A labelled search box lists up to eight matching names as buttons, which
 * are in the normal tab order, so a keyboard reaches them (Enter in the box
 * adds the first). Each chosen area is a chip with a "Remove" button, and
 * "Clear" removes them all. The choice is in the address as `?areas=`: it is
 * changed with a client navigation, so the server loads the chart's data for
 * the new areas (the chips update straight away; the chart follows).
 *
 * @param options - Every area that can be chosen, by name.
 * @param selected - The areas chosen to start with, in the order of their colours.
 * @param noun - What the areas are called, singular and plural, such as "local authority".
 */
export function AreaPicker({
  options,
  selected: initial,
  limit,
  noun,
  nounPlural,
}: {
  options: readonly AreaOption[];
  selected: readonly string[];
  limit: number;
  noun: string;
  nounPlural: string;
}) {
  const ids = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([...initial]);
  const [text, setText] = useState("");

  const byCode = new Map(options.map((option) => [option.code, option]));
  const full = selected.length >= limit;
  const { shown, total } = findMatches(options, text, new Set(selected));

  function choose(codes: string[]) {
    setSelected(codes);
    // Read from the address bar, not `useSearchParams()`: the range is
    // written with `history.replaceState`, which that hook may not have seen.
    const query = new URLSearchParams(window.location.search);
    if (codes.length > 0) query.set("areas", codes.join(","));
    else query.delete("areas");
    const queryText = query.toString().replaceAll("%2C", ",");
    startTransition(() => {
      router.replace(queryText ? `${pathname}?${queryText}` : pathname, { scroll: false });
    });
  }

  function add(code: string) {
    if (full || selected.includes(code)) return;
    choose([...selected, code]);
    setText("");
  }

  const matchesId = `${ids}-matches`;
  return (
    <section aria-labelledby={`${ids}-heading`} className="mt-4">
      <h2 id={`${ids}-heading`} className="mb-2 text-sm font-medium text-muted">
        Compare with England: choose up to {limit} {nounPlural}.
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
              if (event.key === "Enter" && shown[0]) {
                event.preventDefault();
                add(shown[0].code);
              }
            }}
            aria-describedby={matchesId}
            className="min-h-11 rounded-md border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <div id={matchesId}>
            {text.trim() === "" ? null : (
              <>
                <p role="status" className="text-sm text-muted">
                  {total === 0
                    ? `No ${nounPlural} match.`
                    : total > shown.length
                      ? `Showing ${shown.length} of ${total} matches. Type more to narrow the list.`
                      : `${total} ${total === 1 ? "match" : "matches"}.`}
                </p>
                <ul className="mt-1 grid">
                  {shown.map((option) => (
                    <li key={option.code}>
                      <button
                        type="button"
                        onClick={() => add(option.code)}
                        className="flex min-h-11 w-full cursor-pointer items-center rounded-md px-3 text-left hover:bg-brand/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                      >
                        <span className="sr-only">Add </span>
                        {option.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
      <p role="status" className="sr-only">
        {pending ? "Updating the chart…" : ""}
      </p>
    </section>
  );
}
