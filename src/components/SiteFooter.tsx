import Link from "next/link";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** The site footer: links to the sources and about pages, and the copyright line. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-muted sm:px-6">
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
        <p className="mt-2">© 2026 Disease Observer</p>
      </div>
    </footer>
  );
}
