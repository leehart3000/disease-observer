import Link from "next/link";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * The site footer: the copyright line, and links to the sources and about
 * pages. On wide screens they share one line, with the links at the right.
 * On narrow screens the links wrap beneath the copyright line.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-start px-4 py-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-x-6 sm:px-6">
        <p className="py-2">© 2026 Disease Observer</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6">
            <li>
              <Link href="/sources" className={linkClass}>
                Sources
              </Link>
            </li>
            <li>
              <Link href="/about" className={linkClass}>
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
