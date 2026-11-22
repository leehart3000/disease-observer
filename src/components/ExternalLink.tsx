import { EXTERNAL_ICON_PATHS, EXTERNAL_LINK_HINT, EXTERNAL_LINK_REL } from "@/lib/external-link";

/**
 * A link to another website. Use this for every one, so they all look and
 * behave the same: it opens in a new tab (`rel="noopener noreferrer"`), shows
 * a small "opens in a new tab" icon after the text, and has the words
 * "(opens in a new tab)" for screen readers.
 *
 * The icon is joined to the last word of the text, so it never wraps onto a
 * line by itself. The text must be a string, for that reason.
 */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: string;
}) {
  const text = children.trimEnd();
  const split = text.lastIndexOf(" ") + 1;
  return (
    <a href={href} target="_blank" rel={EXTERNAL_LINK_REL} className={className}>
      {text.slice(0, split)}
      <span className="whitespace-nowrap">
        {text.slice(split)}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="external-link-icon"
        >
          {EXTERNAL_ICON_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <span className="sr-only"> {EXTERNAL_LINK_HINT}</span>
      </span>
    </a>
  );
}
