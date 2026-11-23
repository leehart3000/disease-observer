import { DATASETS, getDatasetBySlug, getDisease } from "@/lib/datasets/registry";
import { renderOgImage } from "@/lib/og-image";

export const alt = "Disease Observer: a dataset, with its map, chart and table";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Every dataset in the registry has its image made at build time. */
export function generateStaticParams() {
  return DATASETS.map((dataset) => ({ slug: dataset.diseaseSlug, dataset: dataset.slug }));
}

/**
 * The card image of a dataset page and of its map, chart and table pages: the
 * dataset's name, its disease and its description.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; dataset: string }>;
}) {
  const { slug, dataset: datasetSlug } = await params;
  const dataset = getDatasetBySlug(slug, datasetSlug);
  const disease = getDisease(slug);
  if (!dataset || !disease) return new Response(null, { status: 404 });
  return renderOgImage({ kicker: disease.name, title: dataset.label, description: dataset.description });
}
