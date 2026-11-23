import type { Metadata } from "next";
import Link from "next/link";
import { strongLink, textLink } from "@/components/link-styles";
import { DISEASES } from "@/lib/datasets/registry";
import { diseaseHref, LOCATIONS_HREF, MAPS_HREF } from "@/lib/datasets/routes";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page could not be found.",
};

/**
 * What a visitor sees at an address that has no page (the site answers with a
 * 404). It is the site's own page, with its header and footer, and offers the
 * places to go next: the home page, the main sections and each disease. The
 * links come from the registry, so a new disease is here without more work.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-muted">Error 404</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl">
        This page could not be found.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        The address may be mistyped, or the page may have moved. These pages may help.
      </p>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Go to</h2>
      <ul className="flex max-w-2xl flex-wrap gap-x-6">
        {[
          { href: "/", label: "The home page" },
          { href: "/diseases", label: "All diseases" },
          { href: MAPS_HREF, label: "Maps" },
          { href: LOCATIONS_HREF, label: "Locations" },
          { href: "/sources", label: "Sources" },
          { href: "/about", label: "About" },
        ].map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className={`${strongLink} inline-flex min-h-11 items-center`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-2xl font-medium tracking-tight">Or look at a disease</h2>
      <ul className="flex flex-wrap gap-x-5">
        {DISEASES.map((disease) => (
          <li key={disease.slug}>
            <Link href={diseaseHref(disease.slug)} className={`${textLink} inline-flex min-h-11 items-center`}>
              {disease.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
