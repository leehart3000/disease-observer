import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";
import { textLink } from "./link-styles";

/** One step of a trail. The last item is the current page. */
export type Crumb = { label: string; href: string };

/**
 * The trail to the current page, such as Diseases > COVID-19. It is shown
 * only where there are two or more steps, and renders nothing otherwise, so
 * a page cannot show a lone crumb. There is no "Home" step: the wordmark is
 * the home link.
 *
 * Markup: a `nav` named "Breadcrumb" with an ordered list. Every step but the
 * last is a link, and the last is plain text marked `aria-current="page"`.
 * The separators are hidden from screen readers. The same steps are
 * written as a `BreadcrumbList` in JSON-LD for search engines.
 */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  if (items.length < 2) return null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: absoluteUrl(item.href),
    })),
  };
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center text-sm text-muted">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={item.href} className="flex items-center">
                {last ? (
                  <span aria-current="page" className="py-2 text-ink">
                    {item.label}
                  </span>
                ) : (
                  <>
                    <Link href={item.href} className={`${textLink} inline-flex min-h-11 items-center`}>
                      {item.label}
                    </Link>
                    <span aria-hidden="true" className="px-2">
                      ›
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        // "<" is escaped so the data can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
