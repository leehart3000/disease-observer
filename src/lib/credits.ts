import type { SourceCredit } from "@/lib/map/types";

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
