/**
 * The site's address, and the canonical link of a page. Everything that
 * needs an absolute URL (metadata, the sitemap, robots, breadcrumb data)
 * uses this one place.
 *
 * Erasable TypeScript only, so tests can import it too.
 */

/** Where the site lives, with no trailing slash. */
export const SITE_URL = "https://disease.observer";

/**
 * The `alternates` metadata of a page: its canonical link, which is the
 * page's own path with no query string. States such as `?p=12w` or
 * `?areas=…` are views of the same page, so they never become separate
 * indexed pages. Relative to `metadataBase` (see `layout.tsx`).
 *
 * @param path - The page's path, such as `/about`.
 */
export function canonicalFor(path: string): { canonical: string } {
  return { canonical: path };
}

/** The absolute URL of a path on the site. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
