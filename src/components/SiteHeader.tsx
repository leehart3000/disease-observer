import Link from "next/link";
import { Mark } from "./Mark";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

/**
 * The site header: the horizontal lockup (mark left of the wordmark) linking
 * to the home page, the main links, and the theme toggle at the right. It
 * sits on the surface colour with a bottom border.
 *
 * Below the `sm` breakpoint the links do not fit beside the wordmark, so
 * they wrap onto a second row under it.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="order-1 flex items-center gap-2 rounded-md text-[1.5rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-[1.75rem]"
        >
          <Mark className="h-[1.5em] w-auto" />
          <Wordmark />
        </Link>
        <div className="order-2 ml-auto sm:order-3">
          <ThemeToggle />
        </div>
        <NavLinks className="order-3 w-full sm:order-2 sm:ml-4 sm:mr-auto sm:w-auto" />
      </div>
    </header>
  );
}
