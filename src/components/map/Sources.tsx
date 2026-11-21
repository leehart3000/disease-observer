import type { SourceCredit } from "@/lib/map/types";

/** Splits a credit into lines at the end of each sentence. */
function lines(attribution: string): string[] {
  return attribution.split(/(?<=\.)\s+(?=[A-Z])/);
}

/**
 * The credits for everything on the map. The base map credit is fixed; the
 * data credits and licences come from the `sources` table.
 */
export function Sources({ credits }: { credits: SourceCredit[] }) {
  const link = "underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return (
    <section aria-labelledby="sources-heading" className="mt-8 text-sm text-muted">
      <h2 id="sources-heading" className="mb-2 font-medium text-ink">
        Sources
      </h2>
      <ul className="grid gap-3">
        <li>
          <p>
            <a className={link} href="https://openfreemap.org">
              OpenFreeMap
            </a>{" "}
            <a className={link} href="https://www.openmaptiles.org/">
              &copy; OpenMapTiles
            </a>{" "}
            Data from{" "}
            <a className={link} href="https://www.openstreetmap.org/copyright">
              OpenStreetMap
            </a>
          </p>
        </li>
        {credits.map((credit) => (
          <li key={credit.slug}>
            <p>
              <a className={link} href={credit.url}>
                {credit.name}
              </a>
            </p>
            {lines(credit.attribution).map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>
              Licence:{" "}
              <a className={link} href={credit.licenceUrl}>
                {credit.licenceName}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
