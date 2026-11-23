"use client";

import { useState } from "react";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import type { DiseaseSeries } from "@/lib/series-types";
import { LineChart } from "./LineChart";

/** A place's series for the disease chart, with the place's name for the choice. */
export type PlaceSeries = {
  placeName: string;
  series: DiseaseSeries;
};

/**
 * The disease page's chart for one or more places. With one place it is just
 * the chart. With more (COVID-19 in England and the United States) a choice
 * of place sits above it, and each place has its own chart, measure label and
 * areas. The first place is the one shown to start with.
 *
 * The places are never drawn together, because they can report different
 * measures (cases in one, hospital admissions in another).
 */
export function DiseaseChartPlaces({
  places,
  diseaseName,
  sinceLabel,
}: {
  places: readonly PlaceSeries[];
  diseaseName: string;
  sinceLabel: string;
}) {
  const [chosen, setChosen] = useState(places[0]?.series.datasetId ?? "");
  const current = places.find((place) => place.series.datasetId === chosen) ?? places[0];
  if (!current) return null;

  return (
    <div>
      {places.length > 1 ? (
        <SegmentedChoice
          legend="Place"
          options={places.map((place) => ({
            value: place.series.datasetId,
            label: place.placeName,
          }))}
          value={current.series.datasetId}
          onChange={setChosen}
          className="mb-4"
        />
      ) : null}
      <LineChart
        key={current.series.datasetId}
        series={current.series}
        diseaseName={diseaseName}
        sinceLabel={sinceLabel}
      />
    </div>
  );
}
