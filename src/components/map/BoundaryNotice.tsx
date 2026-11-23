/** Where a map's boundaries come from, for the notice under it. */
export type BoundaryNoticeKind = "natural-earth";

const NOTICES: Record<BoundaryNoticeKind, string> = {
  "natural-earth":
    "Boundaries and names are from Natural Earth, a public-domain dataset, and are drawn for display only. They do not imply any view on the status of a country or territory, or on where its borders lie.",
};

/**
 * A short notice under a map about where its boundaries come from and what
 * they do not imply. Shown for a map whose dataset sets `map.boundaryNotice`
 * (the US state map, from Natural Earth's boundaries). It is plain text, so
 * it is not hidden when the map goes full screen: it sits outside the map's
 * frame.
 */
export function BoundaryNotice({ kind }: { kind: BoundaryNoticeKind }) {
  return (
    <p data-testid="boundary-notice" className="text-sm text-muted">
      {NOTICES[kind]}
    </p>
  );
}
