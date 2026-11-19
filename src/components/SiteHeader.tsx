import Link from "next/link";
import { Mark } from "./Mark";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

/**
 * The site header: the horizontal lockup (mark left of the wordmark) linking
 * to the home page, and the theme toggle at the right. It sits on the surface
 * colour with a bottom border.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-[1.5rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-[1.75rem]"
        >
          <Mark className="h-[1.5em] w-auto" />
          <Wordmark />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
