/**
 * How Natural Earth's countries and US states become the codes, names and
 * slugs this site uses. Shared by the extract step
 * (`prepare-natural-earth.mts`) and the tests.
 *
 * Countries are identified by ISO 3166-1 alpha-3 codes (`FRA`, `USA`). Natural
 * Earth leaves some of them out or shares them, so there are rules and a short
 * table of exceptions below. US states are identified by ISO 3166-2 codes
 * (`US-AL`).
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */

/** The `code_scheme` of a country's code in the `areas` table. */
export const COUNTRY_CODE_SCHEME = "iso3166-1-alpha3";

/** The `code_scheme` of a US state's code in the `areas` table. */
export const US_STATE_CODE_SCHEME = "iso3166-2";

/**
 * Slugs that a place already has, so no country may take them. England is a
 * place of its own (from the ONS datasets), not the same as `united-kingdom`.
 */
export const RESERVED_SLUGS: readonly string[] = ["england"];

/**
 * Codes to use in place of the one Natural Earth gives, by Natural Earth's own
 * code (`ADM0_A3`). Kosovo has no ISO 3166-1 code; `XKX` is the user-assigned
 * code that most data sets use for it.
 */
export const CODE_OVERRIDES: Record<string, string> = {
  KOS: "XKX",
};

/**
 * Names to show in place of Natural Earth's `ADMIN`, where that is formal,
 * abbreviated or unusual. Keyed by `ADMIN`.
 */
export const NAME_OVERRIDES: Record<string, string> = {
  "United States of America": "United States",
  "Republic of Serbia": "Serbia",
  "Ivory Coast": "Côte d'Ivoire",
  "Hong Kong S.A.R.": "Hong Kong",
  "Macao S.A.R": "Macao",
  eSwatini: "Eswatini",
  "East Timor": "Timor-Leste",
  "The Bahamas": "Bahamas",
  "United Republic of Tanzania": "Tanzania",
  Vatican: "Vatican City",
  Aland: "Åland Islands",
  "Saint Barthelemy": "Saint Barthélemy",
  "São Tomé and Principe": "São Tomé and Príncipe",
};

/**
 * Makes a URL slug from a name: lowercase, accents removed, `&` as `and`, and
 * every other run of characters that are not letters or digits (apostrophes
 * and spaces included) as one hyphen, with none at either end.
 *
 * @example slugify("Côte d'Ivoire") // "cote-d-ivoire"
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The name to show for a country: the override if there is one, else Natural Earth's `ADMIN`. */
export function countryName(admin: string): string {
  return NAME_OVERRIDES[admin] ?? admin;
}

/** The Natural Earth properties that decide a country's code. */
export type CountryCodeInput = {
  /** `ISO_A3_EH`: the ISO code, with France and Norway filled in. `-99` where there is none. */
  isoA3Eh: string;
  /** `ADM0_A3`: Natural Earth's own code. */
  adm0A3: string;
};

/** Where a country's code came from, for the report. */
export type CodeSource = "iso" | "override" | "natural-earth";

const ISO_LIKE = /^[A-Z]{3}$/;

/**
 * Chooses the code of every country in the list (in the same order).
 *
 * The ISO code is used if there is one and it belongs to this feature alone.
 * Where two features have the same one (Australia's two territories also say
 * `AUS`), the one whose own code agrees keeps it, and the others use
 * Natural Earth's own code. Features with no ISO code at all (Somaliland,
 * Northern Cyprus, Siachen Glacier) also use Natural Earth's own. Then
 * `CODE_OVERRIDES` is applied.
 */
export function chooseCountryCodes(
  inputs: readonly CountryCodeInput[],
): Array<{ code: string; source: CodeSource }> {
  const uses = new Map<string, number>();
  for (const { isoA3Eh } of inputs) uses.set(isoA3Eh, (uses.get(isoA3Eh) ?? 0) + 1);

  return inputs.map(({ isoA3Eh, adm0A3 }) => {
    const hasIso = ISO_LIKE.test(isoA3Eh);
    const keepsIso = hasIso && ((uses.get(isoA3Eh) ?? 0) === 1 || adm0A3 === isoA3Eh);
    const chosen = keepsIso ? isoA3Eh : adm0A3;
    const override = CODE_OVERRIDES[chosen];
    if (override) return { code: override, source: "override" as const };
    return { code: chosen, source: keepsIso ? ("iso" as const) : ("natural-earth" as const) };
  });
}

/** The ISO 3166-2 code of a US state, such as `US-AL`, from Natural Earth's `iso_3166_2`. */
export function usStateCode(iso31662: unknown): string {
  if (typeof iso31662 !== "string" || !/^US-[A-Z]{2}$/.test(iso31662)) {
    throw new Error(`Not a US state code: ${String(iso31662)}`);
  }
  return iso31662;
}
