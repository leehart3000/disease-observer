import { connection } from "next/server";
import { loadSources } from "@/lib/data/sources";
import type { SourceCredit } from "@/lib/map/types";
import { SourceList } from "./SourceList";

/**
 * The credits for the sources with the given slugs, in that order. They are
 * read from the `sources` table, so this waits for a real request before it
 * touches the database, and nothing is queried while the site is built. If
 * the table can't be read, a short message is shown in place of the list.
 *
 * @param slugs - The `sources` rows to show, from the registry.
 * @param extra - Credits that are not in the table, shown after the others.
 */
export async function SourcesSection({
  slugs,
  extra = [],
}: {
  slugs: readonly string[];
  extra?: readonly SourceCredit[];
}) {
  await connection();
  const result = await loadSources();
  if (result.status !== "ok") {
    return (
      <>
        <p role="status">Sources unavailable. The source details can’t be loaded at the moment.</p>
        {extra.length > 0 && (
          <div className="mt-4">
            <SourceList credits={extra} />
          </div>
        )}
      </>
    );
  }
  const credits = slugs.flatMap((slug) => result.data.filter((credit) => credit.slug === slug));
  return <SourceList credits={[...credits, ...extra]} />;
}

/** Shown while the sources load. */
export function SourcesFallback() {
  return <p role="status">Loading the sources&hellip;</p>;
}
