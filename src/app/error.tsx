"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

/**
 * The page shown when a page fails while it renders. It sits inside the root
 * layout, so the header and footer are still there. No details of the error
 * are shown. A failure of the layout itself is handled by `global-error.tsx`.
 */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
      <ErrorPanel retry={retry} />
    </main>
  );
}
