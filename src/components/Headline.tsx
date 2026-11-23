import { Suspense } from "react";
import { connection } from "next/server";
import { formatMeasureValue, formatPeriod, formatValue } from "@/lib/format";
import { getDataset, headlineDatasets } from "@/lib/datasets/registry";
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
  id?: string;
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
          {formatMeasureValue(dataset, headline.value)}
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

/** What stands in for the figure(s) while loading: the height of one figure for each place. */
function HeadlineFallback({ count = 1 }: { count?: number }) {
  return <div className="mt-4" style={{ height: `${8.5 * count}rem` }} aria-hidden="true" />;
}

/**
 * The data-driven part: one figure for each place the disease has data for,
 * each with its place and its own measure. It waits for a real request before
 * it touches the database.
 */
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
  // In the order of the places (the default place first), whichever have data.
  const headlines = headlineDatasets(slug).flatMap((dataset) =>
    result.data.filter((entry) => entry.datasetId === dataset.id),
  );
  if (headlines.length === 0) {
    return (
      <p id={id} className="mt-4 text-sm text-muted">
        No figure yet
      </p>
    );
  }
  return (
    <div id={id}>
      {headlines.map((headline) => (
        <HeadlineFigure key={headline.datasetId} headline={headline} />
      ))}
      {headlines.length > 1 ? (
        <p className="mt-4 text-sm text-muted" data-testid="not-comparable">
          These figures measure different things, so they can’t be compared.
        </p>
      ) : null}
    </div>
  );
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
    <Suspense fallback={<HeadlineFallback count={headlineDatasets(slug).length} />}>
      <HeadlineData slug={slug} id={id} />
    </Suspense>
  );
}
