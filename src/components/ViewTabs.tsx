"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { VIEW_LABELS } from "@/lib/datasets/routes";
import type { View } from "@/lib/datasets/types";
import { parseAreaCodes } from "@/lib/datasets/url";

/** One view of a dataset: which one, and the address of its page. */
export type ViewTab = { view: View; href: string };

/** The strip of links. It does not read the address, so it is also what shows before the page is ready. */
function TabList({
  datasetName,
  tabs,
  current,
  query,
}: {
  datasetName: string;
  tabs: readonly ViewTab[];
  current: View;
  /** The state to keep when moving between views, such as `?areas=E06000001`. */
  query: string;
}) {
  return (
    <nav aria-label={`Views of ${datasetName}`}>
      <ul className="flex flex-wrap gap-x-1 border-b border-line">
        {tabs.map(({ view, href }) => (
          <li key={view}>
            <Link
              href={`${href}${query}`}
              aria-current={view === current ? "page" : undefined}
              className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-4 text-muted hover:border-line hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand aria-[current=page]:border-brand aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {VIEW_LABELS[view]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The same strip, keeping the chosen areas from the page's address (`?areas=`) in every link. */
function StatefulTabs(props: Omit<Parameters<typeof TabList>[0], "query">) {
  const areas = parseAreaCodes(useSearchParams().get("areas") ?? undefined, 10);
  return <TabList {...props} query={areas.length > 0 ? `?areas=${areas.join(",")}` : ""} />;
}

/**
 * The views of a dataset as a strip of links, like the view buttons of an
 * explorer: each is a page of its own, and the current one is marked with
 * `aria-current="page"`. They are links, not ARIA tabs.
 *
 * The chosen areas stay in the address when moving between views, including
 * a pin made after the page loaded (the map rewrites the address without a
 * page load). Reading the address needs the page to be ready, so until then
 * the links are plain ones. It renders nothing for fewer than two views.
 */
export function ViewTabs(props: {
  datasetName: string;
  tabs: readonly ViewTab[];
  current: View;
}) {
  if (props.tabs.length < 2) return null;
  return (
    <Suspense fallback={<TabList {...props} query="" />}>
      <StatefulTabs {...props} />
    </Suspense>
  );
}
