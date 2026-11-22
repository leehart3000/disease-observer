"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The links in the header. Add a line here to add a page to the menu. */
const LINKS = [
  { href: "/diseases", label: "Diseases" },
  { href: "/maps", label: "Maps" },
] as const;

/**
 * The main navigation. The link for the current page (or a page inside it,
 * such as a disease page under Diseases) is marked with `aria-current`.
 */
export function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-muted underline-offset-8 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-[current=page]:font-medium aria-[current=page]:text-ink aria-[current=page]:underline"
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
