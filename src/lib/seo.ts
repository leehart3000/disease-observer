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

/** The site's name, as it is in titles and on social cards. */
export const SITE_NAME = "Disease Observer";

/**
 * The Open Graph and Twitter card text of a page. The picture comes from the
 * `opengraph-image` and `twitter-image` files (see `src/lib/og-image.tsx`). A
 * page that sets `openGraph` or `twitter` replaces the root layout's, so this
 * has the site-wide parts (name, type, locale, card type) too.
 *
 * @param title - The page's whole title, as a person sees it ("Influenza | Disease Observer").
 * @param path - The page's path, such as `/diseases/influenza`.
 */
export function socialMetadata(title: string, description: string, path: string) {
  return {
    openGraph: {
      type: "website" as const,
      siteName: SITE_NAME,
      locale: "en_GB",
      title,
      description,
      url: path,
    },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}

/** The absolute URL of a path on the site. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
