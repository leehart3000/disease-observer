"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { parseChartRange } from "@/lib/datasets/url";
import type { ChartRange } from "./LineChartPlot";

/**
 * The time range of a chart, chosen with a `SegmentedChoice`.
 *
 * With `inUrl`, the address is the only place the range is kept: it is read
 * from `?range=` (`all`, or left out for the last 12 months) with
 * `useSearchParams`, and a choice rewrites the address through the router.
 * There is no separate state to drift from the address, for example when
 * Next.js restores a page that was visited before. The choice shows at
 * once, and the page follows when the router has finished.
 *
 * Without `inUrl` (the disease page's chart), the range is plain state.
 */
export function useChartRange(inUrl: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [local, setLocal] = useState<ChartRange>("12m");
  const fromUrl = parseChartRange({ range: params.get("range") ?? undefined });
  const [optimistic, setOptimistic] = useOptimistic(fromUrl);
  const [, startTransition] = useTransition();

  function chooseRange(next: ChartRange) {
    if (!inUrl) {
      setLocal(next);
      return;
    }
    // Built from the address bar, which is always current, so nothing else in
    // the query (such as the chosen areas) is lost.
    const query = new URLSearchParams(window.location.search);
    if (next === "all") query.set("range", "all");
    else query.delete("range");
    const text = query.toString().replaceAll("%2C", ",");
    startTransition(() => {
      setOptimistic(next);
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    });
  }
  return [inUrl ? optimistic : local, chooseRange] as const;
}
