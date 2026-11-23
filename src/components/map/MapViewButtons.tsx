"use client";

import { useState } from "react";

/**
 * Buttons that move a map to places its opening view leaves out, such as
 * "Show Alaska" and "Show Hawaii" on a US map, and "Show all states" to go
 * back. They are real buttons outside the map (so a keyboard and a screen
 * reader reach them without the map), and a status line says where the map
 * went, because the movement itself is only visual.
 *
 * @param views - The places, by label.
 * @param allLabel - What the button that returns to the opening view shows, such as "all states".
 * @param onChoose - Called with a place's label, or `null` for the opening view.
 */
export function MapViewButtons({
  views,
  allLabel,
  onChoose,
}: {
  views: readonly { label: string }[];
  allLabel: string;
  onChoose: (label: string | null) => void;
}) {
  const [message, setMessage] = useState("");
  const buttonClass =
    "inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-3 text-sm hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  function choose(label: string | null) {
    onChoose(label);
    setMessage(`Showing ${label ?? allLabel}.`);
  }

  return (
    <div role="group" aria-label="Move the map" className="flex flex-wrap gap-2">
      {views.map(({ label }) => (
        <button key={label} type="button" className={buttonClass} onClick={() => choose(label)}>
          Show {label}
        </button>
      ))}
      <button type="button" className={buttonClass} onClick={() => choose(null)}>
        Show {allLabel}
      </button>
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
