"use client";

import { strongLink } from "./link-styles";

/** The places to go from an error page. Plain links, so they also work when the whole app has failed. */
const LINKS = [
  { href: "/", label: "The home page" },
  { href: "/diseases", label: "All diseases" },
  { href: "/maps", label: "Maps" },
  { href: "/locations", label: "Locations" },
  { href: "/sources", label: "Sources" },
  { href: "/about", label: "About" },
] as const;

/**
 * What a visitor sees when something goes wrong: a short message, a "Try
 * again" button and links to the main sections. It never shows what went
 * wrong, because the details could give away how the site is built.
 *
 * Used by `error.tsx` (inside the header and footer) and `global-error.tsx`
 * (when even the layout has failed).
 *
 * @param retry - Asks Next.js to try the page again.
 */
export function ErrorPanel({ retry }: { retry: () => void }) {
  return (
    <>
      <p className="text-sm font-medium text-muted">Something went wrong</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl">
        This page could not be shown.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        It may be a temporary problem. Please try again, or go to another page.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-md bg-brand px-5 font-medium text-paper hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Try again
      </button>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Go to</h2>
      <ul className="flex max-w-2xl flex-wrap gap-x-6">
        {LINKS.map(({ href, label }) => (
          <li key={href}>
            <a href={href} className={`${strongLink} inline-flex min-h-11 items-center`}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
