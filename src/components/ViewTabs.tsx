"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PERIOD_VIEWS, VIEW_LABELS } from "@/lib/datasets/routes";
import type { View } from "@/lib/datasets/types";
import { parseAreaCodes } from "@/lib/datasets/url";

/** One view of a dataset: which one, and the address of its page. */
export type ViewTab = { view: View; href: string };

/** The strip of links. It does not read the address, so it is also what shows before the page is ready. */
function TabList({
  datasetName,
  tabs,
  current,
  queryFor,
}: {
  datasetName: string;
  tabs: readonly ViewTab[];
  current: View;
  /** The state to keep when moving to a view, such as `?areas=E06000001&p=ytd`. */
  queryFor: (view: View) => string;
}) {
  return (
    <nav aria-label={`Views of ${datasetName}`}>
      <ul className="flex flex-wrap gap-x-1 border-b border-line">
        {tabs.map(({ view, href }) => (
          <li key={view}>
            <Link
              href={`${href}${queryFor(view)}`}
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

/** The periods that can be in an address besides the default (checked again by the page). */
const KEPT_PERIODS = ["12w", "ytd"];

/**
 * The same strip, keeping the chosen areas (`?areas=`) in every link, and the
 * period (`?p=`) in the links to views that show one.
 */
function StatefulTabs(props: Omit<Parameters<typeof TabList>[0], "queryFor">) {
  const params = useSearchParams();
  const areas = parseAreaCodes(params.get("areas") ?? undefined, 10);
  const wanted = params.get("p") ?? "";
  const period = KEPT_PERIODS.includes(wanted) ? wanted : null;
  return (
    <TabList
      {...props}
      queryFor={(view) => {
        const query = new URLSearchParams();
        if (areas.length > 0) query.set("areas", areas.join(","));
        if (period && PERIOD_VIEWS.includes(view)) query.set("p", period);
        const text = query.toString().replaceAll("%2C", ",");
        return text ? `?${text}` : "";
      }}
    />
  );
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
    <Suspense fallback={<TabList {...props} queryFor={() => ""} />}>
      <StatefulTabs {...props} />
    </Suspense>
  );
}
