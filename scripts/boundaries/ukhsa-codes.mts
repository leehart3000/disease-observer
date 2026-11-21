/**
 * How UKHSA's area codes differ from the ONS codes in `data/ons/`. Shared by
 * the database loader (`load.mts`) and the web asset builder (`web.mts`).
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`.
 */

/** Local authorities that UKHSA reports under one code, with the ONS codes to merge. */
export const COMBINED_AREAS: Record<string, { name: string; onsCodes: string[] }> = {
  E06000052: {
    name: "Cornwall and Isles of Scilly",
    onsCodes: ["E06000052", "E06000053"],
  },
  E09000001: {
    name: "Hackney and City of London",
    onsCodes: ["E09000001", "E09000012"],
  },
};

/** ONS codes that are merged into another area and so get no area of their own. */
export const MERGED_AWAY = new Set(
  Object.entries(COMBINED_AREAS).flatMap(([code, { onsCodes }]) =>
    onsCodes.filter((onsCode) => onsCode !== code),
  ),
);

/** Each ONS region (E12) with the code and name that UKHSA uses (E45). */
export const REGIONS: Record<string, { code: string; name: string }> = {
  E12000001: { code: "E45000009", name: "North East" },
  E12000002: { code: "E45000018", name: "North West" },
  E12000003: { code: "E45000010", name: "Yorkshire and Humber" },
  E12000004: { code: "E45000016", name: "East Midlands" },
  E12000005: { code: "E45000005", name: "West Midlands" },
  E12000006: { code: "E45000017", name: "East of England" },
  E12000007: { code: "E45000001", name: "London" },
  E12000008: { code: "E45000019", name: "South East" },
  E12000009: { code: "E45000020", name: "South West" },
};
