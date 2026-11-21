import type { SourceCredit } from "@/lib/map/types";

/** Splits a credit into lines at the end of each sentence. */
function lines(attribution: string): string[] {
  return attribution.split(/(?<=\.)\s+(?=[A-Z])/);
}

/**
 * The credits for the data on the map. The caller passes only the sources
 * for the dataset that is shown, from the `sources` table, or `null` if
 * they could not be loaded. The base map's own credit is in the map's
 * attribution box.
 */
export function Sources({ credits }: { credits: SourceCredit[] | null }) {
  const link =
    "underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return (
    <section aria-labelledby="sources-heading" className="mt-8 text-sm text-muted">
      <h2 id="sources-heading" className="mb-2 font-medium text-ink">
        Sources
      </h2>
      {credits === null ? (
        <p>The source details can’t be loaded at the moment.</p>
      ) : (
        <ul className="grid gap-3">
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
      )}
    </section>
  );
}
