import { coverageItems } from "@/lib/datasets/registry";

/**
 * What the site covers, as a short list with one item for each place: "England:
 * COVID-19 and measles, from the UK Health Security Agency". It comes from the
 * registry, so a new dataset or place is listed without more work. Used on the
 * home page and the About page.
 */
export function CoverageList() {
  return (
    <div data-testid="coverage">
      <p>Disease Observer currently covers:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {coverageItems().map(({ place, diseases, publisher }) => (
          <li key={`${place}|${publisher}`}>
            <span className="font-medium text-ink">{place}:</span> {diseases}, from the {publisher}
          </li>
        ))}
      </ul>
    </div>
  );
}
