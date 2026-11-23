/**
 * What a page shows in its App Shell, before the page's own content is
 * ready. The page's heading and breadcrumb depend on its address (a
 * disease, a dataset), and the shell is shared by every address of a route,
 * so they can't be in it. On a direct visit to one of the pages the site
 * builds ahead of time, the real content replaces this before the HTML is sent.
 */
export function PageFallback() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-8 sm:px-6 sm:pt-5 sm:pb-12">
      <p role="status" className="text-muted">
        Loading the page&hellip;
      </p>
    </main>
  );
}
