"use client";

import { useId } from "react";

/**
 * A choice of one from a few, drawn as a row of buttons (a column on a
 * phone) with the chosen one filled. It is a real radio group, so it works
 * with a keyboard (arrow keys) and a screen reader: a `fieldset` with a
 * visible `legend`, and a hidden radio input in each button's label.
 *
 * Used for the period on the map and table pages and for the chart's time
 * range, so they look and behave the same.
 */
export function SegmentedChoice<Value extends string>({
  legend,
  options,
  value,
  onChange,
  className = "",
}: {
  /** The group's name, shown above the buttons. */
  legend: string;
  options: ReadonlyArray<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={`grid gap-2 ${className}`}>
      <legend className="mb-2 text-sm font-medium text-muted">{legend}</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 has-checked:border-brand has-checked:bg-brand has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand sm:max-w-56"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
