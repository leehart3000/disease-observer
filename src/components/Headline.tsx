import { Suspense } from "react";
import { connection } from "next/server";
import { formatPeriod, formatValue } from "@/lib/format";
import { getDataset } from "@/lib/datasets/registry";
import type { DatasetDef } from "@/lib/datasets/types";
import { loadDatasetHeadline, loadHeadlines, type Headline as HeadlineData } from "@/lib/data/headlines";
import { Sparkline } from "./Sparkline";

/**
 * The latest figure for a place, with its period, a "Provisional" tag when
 * the source may still revise it, and a sparkline of recent weeks. The
 * sparkline is hidden from screen readers, and a visually hidden sentence
 * says what it shows.
 *
 * @param id - A unique id, so a link can describe itself with this text.
 * @param showPlace - Whether to name the place above the figure (not needed
 *   on the place's own page).
 */
function HeadlineFigure({
  headline,
  id,
  showPlace = true,
}: {
  headline: HeadlineData;
  id: string;
  showPlace?: boolean;
}) {
  const dataset = getDataset(headline.datasetId);
  if (!dataset) return null;
  const first = headline.points[0];
  const weeks = headline.points.length;
  return (
    <div id={id} className="mt-4" data-testid="headline">
      {showPlace ? <p className="text-sm text-muted">{dataset.place.name}</p> : null}
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="text-2xl font-medium tracking-tight">
          {formatValue(dataset, headline.value)}
        </span>
        {headline.provisional && (
          <span className="rounded-sm border border-line px-1.5 py-0.5 text-xs">Provisional</span>
        )}
      </p>
      <p className="text-sm text-muted">
        {formatPeriod(dataset, headline.periodStart, headline.periodEnd)}
      </p>
      {weeks > 1 && (
        <div className="mt-3">
          <Sparkline values={headline.points} />
          <p className="sr-only">
            {`Over the last ${weeks} weeks it went from ${formatValue(dataset, first)} to ${formatValue(dataset, headline.value)}.`}
          </p>
        </div>
      )}
    </div>
  );
}

/** What stands in for the figure while it loads. */
function HeadlineFallback() {
  return <div className="mt-4 h-[8.5rem]" aria-hidden="true" />;
}

/** The data-driven part. It waits for a real request before it touches the database. */
async function HeadlineData({ slug, id }: { slug: string; id: string }) {
  await connection();
  const result = await loadHeadlines();
  if (result.status !== "ok") {
    return (
      <p id={id} className="mt-4 text-sm text-muted">
        {result.status === "error" ? "Figure unavailable" : "No figure yet"}
      </p>
    );
  }
  const headline = result.data.find((entry) => entry.diseaseSlug === slug);
  if (!headline) {
    return (
      <p id={id} className="mt-4 text-sm text-muted">
        No figure yet
      </p>
    );
  }
  return <HeadlineFigure headline={headline} id={id} />;
}

/** The data-driven part of one dataset's figure. It waits for a real request first. */
async function DatasetHeadlineData({ dataset, id }: { dataset: DatasetDef; id: string }) {
  await connection();
  const result = await loadDatasetHeadline(dataset);
  if (result.status !== "ok") {
    return (
      <p id={id} className="mt-4 text-sm text-muted">
        {result.status === "error" ? "Figure unavailable" : "No figure yet"}
      </p>
    );
  }
  return <HeadlineFigure headline={result.data} id={id} showPlace={false} />;
}

/**
 * The latest figure of one dataset for its whole place, for the page of a
 * place. Like the disease headline it streams in, so a slow database never
 * delays the page.
 */
export function DatasetHeadline({ dataset, id }: { dataset: DatasetDef; id: string }) {
  return (
    <Suspense fallback={<HeadlineFallback />}>
      <DatasetHeadlineData dataset={dataset} id={id} />
    </Suspense>
  );
}

/**
 * The headline figure of one disease. The page around it is static: the
 * figure streams in, so a slow database never delays the rest of the page.
 */
export function DiseaseHeadline({ slug, id }: { slug: string; id: string }) {
  return (
    <Suspense fallback={<HeadlineFallback />}>
      <HeadlineData slug={slug} id={id} />
    </Suspense>
  );
}
