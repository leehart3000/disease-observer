import { creditsFor } from "@/lib/credits";
import type { SourceCredit } from "@/lib/map/types";
import { SourceList } from "./SourceList";

/**
 * The credits for the sources with the given slugs, in that order. They are
 * written in code (`src/lib/credits.ts`), so they are in the prerendered HTML
 * of every page, with no database and no loading state.
 *
 * @param slugs - The sources to show, from the registry.
 * @param extra - Credits that are not data sources, shown after the others.
 */
export function SourcesSection({
  slugs,
  extra = [],
}: {
  slugs: readonly string[];
  extra?: readonly SourceCredit[];
}) {
  return <SourceList credits={[...creditsFor(slugs), ...extra]} />;
}
