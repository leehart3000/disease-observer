"use client";

import { getDataset } from "@/lib/datasets/registry";
import { MAX_COMPARED_AREAS } from "@/lib/series-compose";
import type { AreaOption, DiseaseSeries } from "@/lib/series-types";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import { AreaPicker } from "./AreaPicker";
import { LineChartPlot, type ChartRange } from "./LineChartPlot";
import { useChartRange } from "./useChartRange";

/**
 * The chart of a dataset with many areas: the dataset's whole place (England),
 * always, and up to three areas chosen with an `AreaPicker`, each on top in its
 * own colour. The controls are the time range and the picker; `LineChartPlot`
 * draws it.
 *
 * @param series - The whole place first, then the chosen areas in the order of their colours.
 * @param options - Every area that can be chosen.
 * @param sinceLabel - The text of the "whole series" range, such as "Since 2023".
 */
export function AreaChart({
  series,
  options,
  diseaseName,
  sinceLabel,
  noun,
  nounPlural,
}: {
  series: DiseaseSeries;
  options: readonly AreaOption[];
  diseaseName: string;
  sinceLabel: string;
  noun: string;
  nounPlural: string;
}) {
  const dataset = getDataset(series.datasetId);
  const [range, chooseRange] = useChartRange(true);
  if (!dataset) return null;

  const chosen = series.lines.slice(1);
  const ranges: Array<{ value: ChartRange; label: string }> = [
    { value: "12m", label: "Last 12 months" },
    { value: "all", label: sinceLabel },
  ];
  const place = dataset.place.name;
  const scope =
    chosen.length === 0 ? place : `${place} and ${chosen.map((line) => line.name).join(", ")}`;

  return (
    <figure data-testid="line-chart">
      <figcaption className="text-sm text-muted">{dataset.columnHeading.latest}, weekly</figcaption>

      <SegmentedChoice
        legend="Time range"
        options={ranges}
        value={range}
        onChange={chooseRange}
        className="mt-3"
      />

      <AreaPicker
        options={options}
        placeName={place}
        limit={MAX_COMPARED_AREAS}
        noun={noun}
        nounPlural={nounPlural}
      />

      <LineChartPlot
        series={series}
        diseaseName={diseaseName}
        highlights={chosen.map((line, index) => ({ code: line.code, slot: index + 1 }))}
        range={range}
        scope={scope}
      />
    </figure>
  );
}
