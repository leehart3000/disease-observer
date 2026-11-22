import type { SourceCredit } from "@/lib/map/types";
import { ExternalLink } from "./ExternalLink";
import { textLink } from "./link-styles";

/** Splits a credit into lines at the end of each sentence. */
function lines(attribution: string): string[] {
  return attribution.split(/(?<=\.)\s+(?=[A-Z])/);
}

/**
 * A list of data source credits: the name as a link, the attribution line by
 * line, and the licence as a link. Used on the map, the disease pages and
 * the sources page. Both links go to other websites.
 */
export function SourceList({ credits }: { credits: readonly SourceCredit[] }) {
  return (
    <ul className="grid gap-3">
      {credits.map((credit) => (
        <li key={credit.slug}>
          <p>
            <ExternalLink className={textLink} href={credit.url}>
              {credit.name}
            </ExternalLink>
          </p>
          {lines(credit.attribution).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>
            Licence:{" "}
            <ExternalLink className={textLink} href={credit.licenceUrl}>
              {credit.licenceName}
            </ExternalLink>
          </p>
        </li>
      ))}
    </ul>
  );
}
