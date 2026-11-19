type MarkProps = {
  /** Accessible label. When omitted, the mark is decorative and hidden from screen readers. */
  label?: string;
  /** Extra classes, for example to set the height. */
  className?: string;
};

const detailCurve = {
  fill: "none",
  stroke: "var(--mark-detail)",
  strokeOpacity: 0.35,
  strokeWidth: 2,
  strokeLinecap: "round",
} as const;

/**
 * The Disease Observer logo mark: a rod of Asclepius drawn as a chart, inside
 * a narrow oval. Colours follow the active theme.
 *
 * It is decorative unless a `label` is given. Keep it at least 16 px tall.
 */
export function Mark({ label, className }: MarkProps) {
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true, focusable: "false" } as const);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      {...a11y}
    >
      <ellipse cx="32" cy="32" rx="20" ry="32" fill="var(--mark-oval)" />
      <g transform="translate(12.16 12.94) scale(.62)">
        <path d="M22 52C22 48.0 42 48.0 42 44" {...detailCurve} />
        <path d="M42 44C42 40.0 22 40.0 22 36" {...detailCurve} />
        <path d="M22 36C22 31.5 42 31.5 42 27" {...detailCurve} />
        <path d="M42 27C42 23.0 22 23.0 22 19" {...detailCurve} />
        <path
          d="M32 16V58"
          stroke="var(--mark-detail)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="22" cy="52" r="2.86" fill="var(--mark-detail)" />
        <circle cx="42" cy="44" r="4.4" fill="var(--mark-detail)" />
        <circle cx="22" cy="36" r="5.5" fill="var(--mark-detail)" />
        <circle cx="42" cy="27" r="4.4" fill="var(--mark-detail)" />
        <circle cx="22" cy="19" r="2.86" fill="var(--mark-detail)" />
        <circle cx="32" cy="7" r="4.5" fill="var(--mark-top-dot)" />
      </g>
    </svg>
  );
}
