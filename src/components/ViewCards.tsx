import { Card } from "./DiseaseCard";
import { VIEW_LABELS, viewHref } from "@/lib/datasets/routes";
import type { DatasetDef, View } from "@/lib/datasets/types";

/** One sentence on what a view shows, for a dataset. */
function blurb(dataset: DatasetDef, view: View): string {
  switch (view) {
    case "map":
      return `A map of the ${dataset.map.areaNoun}, with a key, and the same figures in a table underneath.`;
    case "chart":
      return `How the figures have changed over time, week by week.`;
    case "table":
      return `Every figure in a table that you can search, sort and page through.`;
  }
}

/**
 * One card for each view that the dataset has a page for. They come from the
 * dataset's `views`, so a view appears here when its page is built.
 */
export function ViewCards({ dataset }: { dataset: DatasetDef }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {dataset.views.map((view) => (
        <Card key={view} href={viewHref(dataset, view)} title={VIEW_LABELS[view]} headingLevel="h3">
          {blurb(dataset, view)}
        </Card>
      ))}
    </div>
  );
}
