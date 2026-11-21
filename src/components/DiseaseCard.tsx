import Link from "next/link";
import type { ReactNode } from "react";

type CardProps = {
  href: string;
  title: string;
  /** The heading level, so the card fits the page's outline. */
  headingLevel: "h2" | "h3";
  children: ReactNode;
};

/**
 * A card with one link, on its heading. The link's click area is stretched
 * over the whole card, so there is only one link to hear and tab to.
 */
export function Card({ href, title, headingLevel: Heading, children }: CardProps) {
  return (
    <article className="relative rounded-md border border-line bg-surface p-5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand">
      <Heading className="text-xl font-medium tracking-tight">
        <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
          {title}
        </Link>
      </Heading>
      <p className="mt-2 text-muted">{children}</p>
    </article>
  );
}

/** A card for a disease in the registry. */
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
  return (
    <Card href={`/diseases/${slug}`} title={name} headingLevel={headingLevel}>
      {summary}
    </Card>
  );
}

/** A card that links to the map. */
export function MapCard({ headingLevel }: { headingLevel: "h2" | "h3" }) {
  return (
    <Card href="/map" title="Map" headingLevel={headingLevel}>
      See where cases are being reported, by local authority and by region.
    </Card>
  );
}
