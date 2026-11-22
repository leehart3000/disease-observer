"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PERIOD_LABELS } from "@/lib/format";
import type { PeriodChoice } from "@/lib/datasets/types";
import { SegmentedChoice } from "./SegmentedChoice";

/**
 * Chooses the period that the map and the table show: the latest week, the
 * last 12 weeks added up, or the year to date added up. It is shown only
 * when the dataset offers more than one. A dataset that offers one (a rate,
 * which cannot be added up) shows its `note` instead, saying why.
 *
 * The choice is in the address (`?p=12w`, left out for the latest period), so
 * it can be shared, and any other state in the address (such as the pinned
 * area) is kept. Choosing navigates in a transition, so the current map and
 * table stay on screen until the new values arrive.
 */
export function PeriodPicker({
  periods,
  period,
  note,
}: {
  /** The periods the dataset offers, from the registry. */
  periods: readonly PeriodChoice[];
  /** The period the page is showing. */
  period: PeriodChoice;
  /** Why there is no choice, for a dataset with one period. */
  note?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // What the visitor has just chosen, which can be ahead of the page.
  const [choice, setChoice] = useState({ from: period, value: period });
  // When the page catches up (or the address changes by other means), follow it.
  if (choice.from !== period) setChoice({ from: period, value: period });

  if (periods.length < 2) {
    return note ? <p className="text-sm text-muted">{note}</p> : null;
  }

  function choose(next: PeriodChoice) {
    setChoice({ from: period, value: next });
    const url = new URL(window.location.href);
    if (next === "latest") url.searchParams.delete("p");
    else url.searchParams.set("p", next);
    startTransition(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }));
  }

  return (
    <div>
      <SegmentedChoice
        legend="Period"
        options={periods.map((value) => ({ value, label: PERIOD_LABELS[value] }))}
        value={choice.value}
        onChange={choose}
      />
      {/* Announced politely, and only while the new values are loading. */}
      <p role="status" className="mt-1 min-h-5 text-sm text-muted">
        {pending ? "Loading…" : ""}
      </p>
    </div>
  );
}
