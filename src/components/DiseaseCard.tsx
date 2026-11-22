import Link from "next/link";
import type { ReactNode } from "react";
import { MAPS_HREF } from "@/lib/datasets/routes";
import { DiseaseHeadline } from "./Headline";

type CardProps = {
  href: string;
  title: string;
  /** The heading level, so the card fits the page's outline. */
  headingLevel: "h2" | "h3";
  /** The id of text that gives the link more detail, such as a figure. */
  describedBy?: string;
  /** The short description. */
  children: ReactNode;
  /** More content under the description, such as a headline figure. */
  footer?: ReactNode;
};

/**
 * A card with one link, on its heading. The link's click area is stretched
 * over the whole card, so there is only one link to hear and tab to.
 */
export function Card({
  href,
  title,
  headingLevel: Heading,
  describedBy,
  children,
  footer,
}: CardProps) {
  return (
    <article className="relative rounded-md border border-line bg-surface p-5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand">
      <Heading className="text-xl font-medium tracking-tight">
        <Link
          href={href}
          aria-describedby={describedBy}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {title}
        </Link>
      </Heading>
      <p className="mt-2 text-muted">{children}</p>
      {footer}
    </article>
  );
}

/**
 * A card for a disease in the registry, with its latest figure for its whole place.
 * The figure streams in; the rest of the card is static.
 */
export function DiseaseCard({
  slug,
  name,
  summary,
  headingLevel,
}: {
  slug: string;
  name: string;
  summary: string;
  headingLevel: "h2" | "h3";
}) {
  const figureId = `headline-${slug}`;
  return (
    <Card
      href={`/diseases/${slug}`}
      title={name}
      headingLevel={headingLevel}
      describedBy={figureId}
      footer={<DiseaseHeadline slug={slug} id={figureId} />}
    >
      {summary}
    </Card>
  );
}

/** A card that links to the list of maps. */
export function MapCard({ headingLevel }: { headingLevel: "h2" | "h3" }) {
  return (
    <Card href={MAPS_HREF} title="Maps" headingLevel={headingLevel}>
      See where cases are being reported, area by area.
    </Card>
  );
}
