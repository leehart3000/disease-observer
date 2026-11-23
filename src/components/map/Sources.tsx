import { SourceList } from "@/components/SourceList";
import type { SourceCredit } from "@/lib/map/types";

/**
 * The credits for the data on the map. The caller passes only the sources
 * for the dataset that is shown. The base map's own credit is in the map's
 * attribution box.
 */
export function Sources({ credits }: { credits: readonly SourceCredit[] }) {
  return (
    <section aria-labelledby="sources-heading" className="mt-8 text-sm text-muted">
      <h2 id="sources-heading" className="mb-2 font-medium text-ink">
        Sources
      </h2>
      <SourceList credits={credits} />
    </section>
  );
}
