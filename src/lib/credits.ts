/**
 * The credits and licences of the data sources, and of the base map. They are
 * written here, in code, so every page shows them in its prerendered HTML with
 * no database lookup. `pnpm db:seed` writes the same rows into the `sources`
 * table (the ETL records which source each observation came from), and a test
 * keeps the two in step.
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so the
 * seed script and the tests can import it too.
 */
import type { SourceCredit } from "./map/types.ts";

/**
 * Every row of the `sources` table. `who-flunet` has no dataset yet, so no
 * page shows it (`usedSourceSlugs` in the registry says which are used).
 */
export const SOURCES = [
  {
    slug: "ukhsa",
    name: "UKHSA data dashboard",
    url: "https://ukhsa-dashboard.data.gov.uk/",
    licenceName: "Open Government Licence v3.0",
    licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
  },
  {
    slug: "ons-geography",
    name: "Office for National Statistics: Open Geography Portal",
    url: "https://geoportal.statistics.gov.uk/",
    licenceName: "Open Government Licence v3.0",
    licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    attribution:
      "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2022.",
  },
  {
    slug: "cdc-nhsn",
    name: "CDC National Healthcare Safety Network (NHSN)",
    url: "https://data.cdc.gov/d/ua7e-t2fy",
    licenceName: "Public Domain U.S. Government",
    licenceUrl: "https://www.usa.gov/government-works",
    attribution:
      "Source: CDC National Healthcare Safety Network (NHSN), Weekly Hospital Respiratory Data (HRD) Metrics by Jurisdiction, from data.cdc.gov.",
  },
  {
    slug: "natural-earth",
    name: "Natural Earth",
    url: "https://www.naturalearthdata.com/",
    licenceName: "Public domain",
    licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
    attribution: "Made with Natural Earth.",
  },
  {
    slug: "who-flunet",
    name: "WHO FluNet",
    url: "https://www.who.int/tools/flunet",
    licenceName: "WHO terms and conditions for datasets",
    licenceUrl: "https://www.who.int/about/policies/publishing/data-policy/terms-and-conditions",
    attribution:
      "Data from WHO FluNet, Global Influenza Surveillance and Response System (GISRS), World Health Organization.",
  },
] as const satisfies readonly SourceCredit[];

/**
 * The credit for the base map. It is not a data source, so it is not in the
 * `sources` table. The map's own attribution box shows the short form.
 */
export const BASE_MAP_CREDIT: SourceCredit = {
  slug: "openfreemap",
  name: "OpenFreeMap base map",
  url: "https://openfreemap.org/",
  licenceName: "Open Database Licence (OpenStreetMap data)",
  licenceUrl: "https://www.openstreetmap.org/copyright",
  attribution: "OpenFreeMap © OpenMapTiles. Data from OpenStreetMap.",
};

/** The credits for the sources with these slugs, in that order. An unknown slug is left out. */
export function creditsFor(slugs: readonly string[]): SourceCredit[] {
  const all: readonly SourceCredit[] = SOURCES;
  return slugs.flatMap((slug) => all.filter((credit) => credit.slug === slug));
}
