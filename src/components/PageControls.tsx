/** Shared by the tables: page sizes, field styles and the Previous and Next controls. */

/** The rows-per-page choices. `all` shows every row on one page. */
export const PAGE_SIZES = ["25", "50", "100", "all"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-3 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

export const fieldClass =
  "min-h-11 rounded-md border border-line bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * Previous and Next buttons with the page number. It is used above and
 * below a table, and both copies show the same page. It renders nothing
 * when there is only one page. It is not a live region: the result count
 * above the table is the one that is announced.
 */
export function PageControls({
  label,
  page,
  pageCount,
  onPage,
}: {
  label: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm text-muted">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
