"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { DISEASES, datasetsForDisease } from "@/lib/datasets/registry";
import { mapHref } from "@/lib/datasets/url";

/**
 * Chooses which dataset the map shows. It is a labelled native `<select>`
 * with one group per disease, so it works with a keyboard, a screen reader
 * and a phone's own picker.
 *
 * The choice is in the URL (`/map?d=measles-cases`), so it can be shared.
 * Changing it navigates in a transition: the current map stays on screen
 * until the new values arrive, and the map itself is not recreated.
 */
export function DatasetPicker({ selectedId }: { selectedId: string }) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  // What the visitor has just chosen, which can be ahead of the page.
  const [choice, setChoice] = useState({ from: selectedId, id: selectedId });
  // When the page catches up (or the URL changes by other means), follow it.
  if (choice.from !== selectedId) setChoice({ from: selectedId, id: selectedId });

  return (
    <div className="grid gap-1 sm:max-w-md">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-muted">
          Dataset
        </label>
        {/* Announced politely, and only while the new values are loading. */}
        <span role="status" className="text-sm text-muted">
          {pending ? "Loading…" : ""}
        </span>
      </div>
      <select
        id={id}
        value={choice.id}
        onChange={(event) => {
          const next = event.target.value;
          setChoice({ from: selectedId, id: next });
          startTransition(() => router.replace(mapHref(next), { scroll: false }));
        }}
        className="min-h-11 w-full rounded-md border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {DISEASES.map((disease) => (
          <optgroup key={disease.slug} label={disease.name}>
            {datasetsForDisease(disease.slug).map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
