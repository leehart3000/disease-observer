/**
 * What every link to another website has in common, in one place: it opens
 * in a new tab, with `rel="noopener noreferrer"`, an "opens in a new tab"
 * icon after its text, and the same words for people who use a screen
 * reader. The `ExternalLink` component uses these for our own links, and
 * `decorateExternalAnchor` for the few links we do not write ourselves (the
 * map's attribution box, which MapLibre builds from the base map's style).
 */

/** The `rel` of every external link. */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

/** The words added to an external link for screen readers. */
export const EXTERNAL_LINK_HINT = "(opens in a new tab)";

/** The icon's SVG paths (24 by 24, drawn as a stroke): a square with an arrow leaving its top right corner. */
export const EXTERNAL_ICON_PATHS = [
  "M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6",
  "m21 3-9 9",
  "M15 3h6v6",
] as const;

/** True if `href` is an absolute address on a different site from `pageOrigin`. */
export function isExternalHref(href: string, pageOrigin: string): boolean {
  try {
    return new URL(href, pageOrigin).origin !== pageOrigin;
  } catch {
    return false;
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Turns an existing link to another website into an external link as above:
 * the new tab, the `rel`, the icon and the hidden words. It does nothing if
 * the link is not external or has already been done. Browser only.
 *
 * The link text is kept on one line, so the icon never wraps away from it.
 */
export function decorateExternalAnchor(anchor: HTMLAnchorElement): void {
  if (anchor.dataset.external === "true") return;
  if (!isExternalHref(anchor.href, window.location.origin)) return;
  anchor.dataset.external = "true";
  anchor.target = "_blank";
  anchor.rel = EXTERNAL_LINK_REL;
  anchor.style.whiteSpace = "nowrap";

  const icon = document.createElementNS(SVG_NS, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("class", "external-link-icon");
  for (const d of EXTERNAL_ICON_PATHS) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    icon.appendChild(path);
  }
  const hint = document.createElement("span");
  hint.className = "sr-only";
  hint.textContent = ` ${EXTERNAL_LINK_HINT}`;
  anchor.append(icon, hint);
}
