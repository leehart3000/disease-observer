import { SourceList } from "@/components/SourceList";
import type { SourceCredit } from "@/lib/map/types";

/**
 * The credits for the data on the map. The caller passes only the sources
 * for the dataset that is shown, from the `sources` table, or `null` if
 * they could not be loaded. The base map's own credit is in the map's
 * attribution box.
 */
export function Sources({ credits }: { credits: SourceCredit[] | null }) {
  return (
    <section aria-labelledby="sources-heading" className="mt-8 text-sm text-muted">
      <h2 id="sources-heading" className="mb-2 font-medium text-ink">
        Sources
      </h2>
      {credits === null ? (
        <p>The source details can’t be loaded at the moment.</p>
      ) : (
        <SourceList credits={credits} />
      )}
    </section>
  );
}
