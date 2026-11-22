"use client";

import { useState } from "react";
import type { ChartRange } from "./LineChartPlot";

/**
 * The time range of a chart, chosen with a `SegmentedChoice`.
 *
 * @param initial - The range to start on.
 * @param inUrl - True to keep the range in the address as `?range=all`
 *   (left out for the last 12 months), rewritten with `history.replaceState`
 *   so it needs no page load and keeps the rest of the query.
 */
export function useChartRange(initial: ChartRange, inUrl: boolean) {
  const [range, setRange] = useState<ChartRange>(initial);
  function chooseRange(next: ChartRange) {
    setRange(next);
    if (!inUrl) return;
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.set("range", "all");
    else url.searchParams.delete("range");
    window.history.replaceState(window.history.state, "", url);
  }
  return [range, chooseRange] as const;
}
