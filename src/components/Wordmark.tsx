type WordmarkProps = {
  /** Extra classes, for example to set the font size. */
  className?: string;
};

/**
 * The "disease.observer" wordmark as live text in IBM Plex Sans Medium.
 *
 * The dot on the `i` is the font's own. The `i` is drawn in blue, and a red
 * copy of the same `i` is laid over it, clipped so that only its dot shows.
 * The red copy is a CSS `::after` (`content: "i"`), not text, so the page's
 * text is "disease.observer" and not "diisease.observer" for search engines,
 * copying, reader view and translation.
 * The clip assumes IBM Plex Sans Medium: with a line height of 1.3 the box
 * is 1.3em tall, the baseline is 1.025em from the top, and the gap between
 * the stem (top at 0.52em) and the dot (0.613em to 0.744em) is cut at about
 * 0.565em, which is 35.4% from the top. Recheck this if the font changes.
 *
 * The whole wordmark has the accessible name "disease.observer" and its
 * parts are hidden from screen readers.
 */
export function Wordmark({ className = "" }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label="disease.observer"
      className={`font-medium text-brand ${className}`}
    >
      <span aria-hidden="true">
        d
        <span className="relative inline-block leading-[1.3] after:absolute after:inset-0 after:text-accent after:content-['i'] after:[clip-path:inset(0_0_64.6%_0)]">
          i
        </span>
        sease
        <span className="text-accent">.</span>
        observer
      </span>
    </span>
  );
}
