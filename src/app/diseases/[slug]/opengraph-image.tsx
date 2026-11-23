import { DISEASES, getDisease } from "@/lib/datasets/registry";
import { renderOgImage } from "@/lib/og-image";

export const alt = "Disease Observer: a disease page, with its latest figure and its datasets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Every disease in the registry has its image made at build time. */
export function generateStaticParams() {
  return DISEASES.map(({ slug }) => ({ slug }));
}

/** The card image of a disease page: the disease's name and its summary. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const disease = getDisease((await params).slug);
  if (!disease) return new Response(null, { status: 404 });
  return renderOgImage({ kicker: "Disease", title: disease.name, description: disease.summary });
}
