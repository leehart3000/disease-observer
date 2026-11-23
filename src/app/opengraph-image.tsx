import { coverageSentence } from "@/lib/datasets/registry";
import { renderOgImage } from "@/lib/og-image";

export const alt = "Disease Observer: maps and charts for infectious disease surveillance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card image of the home page, and of every page that has none of its own. */
export default function Image() {
  return renderOgImage({
    title: "Maps and charts for infectious disease surveillance",
    description: coverageSentence(),
  });
}
