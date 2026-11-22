# Natural Earth boundaries

Country and US state boundaries for the map, and the list of countries
(codes, names and slugs) that the site's places are built from.

## Files

- `countries-50m.geojson`: 242 countries, dependencies and disputed areas.
  Each feature has a `code`, a `name`, a `slug` and a geometry.
- `countries.json`: the same, without the shapes (about 13 KB), for code that
  only needs the list.
- `us-states-50m.geojson`: the 50 US states and the District of Columbia.
  Each feature has a `code` (ISO 3166-2, such as `US-AL`), a `name` and a
  geometry. The US territories (Puerto Rico, Guam, the US Virgin Islands,
  American Samoa and the Northern Mariana Islands) are countries in the
  countries file, not states here.

Coordinates are in WGS 84 (longitude and latitude), rounded to 3 decimal
places (about 100 metres, finer than the 1:50 million source).

## Where they come from

[Natural Earth](https://www.naturalearthdata.com/), release **v5.1.2** of the
`natural-earth-vector` repository, at the 1:50 million scale. Natural Earth is
in the public domain
(<https://www.naturalearthdata.com/about/terms-of-use/>). The two raw files
are:

- `ne_50m_admin_0_countries.geojson`:
  <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson>
- `ne_50m_admin_1_states_provinces.geojson`:
  <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_1_states_provinces.geojson>

1:110m leaves out small states (Malta and Liechtenstein among them), and
1:10m is tens of megabytes, so 1:50m is the scale that suits.

## How they were made

Download the two files above into `data/natural-earth/raw/` (ignored by Git),
then run:

```bash
pnpm boundaries:prepare:natural-earth
```

The script (`scripts/boundaries/prepare-natural-earth.mts`) keeps a code, a
name and a slug for each country, and a code and a name for each US state,
rounds the coordinates, and stops if a count, a code or a slug is not as
expected (a different release will need the counts updated).
`pnpm db:boundaries` loads the codes, names and a centroid of every country and
state into the `areas` table (the shapes are not stored in the database), and
`pnpm boundaries:web` builds the files that the map loads.

## Codes

- **Countries** use ISO 3166-1 alpha-3 codes (`FRA`, `USA`), stored with the
  code scheme `iso3166-1-alpha3`. Natural Earth's `ISO_A3` is `-99` for France
  and Norway, so the script uses `ISO_A3_EH`, which has them. Where two
  features share a code (Australia's two territories also say `AUS`), the
  main one keeps it and the others use Natural Earth's own code.
- **Kosovo** has no ISO code; it uses `XKX`, the user-assigned code that most
  data sets use.
- **Features with no ISO code** keep Natural Earth's own: Somaliland `SOL`,
  Northern Cyprus `CYN`, Siachen Glacier `KAS`, Indian Ocean Territories
  `IOA`, and Ashmore and Cartier Islands `ATC`. The script lists them when it
  runs.
- **France** is one feature that includes its overseas departments; they are
  not separate areas.
- **The United Kingdom** (`GBR`) is a different place from England (ONS codes).
- **US states** use ISO 3166-2 codes (`US-AL`), stored with the code scheme
  `iso3166-2`, at the level `region`, with the `USA` country as their parent.

## Names and slugs

The name is Natural Earth's `ADMIN`, except for a few that are formal or odd
(for example "United States of America" is shown as "United States"; see
`NAME_OVERRIDES` in `scripts/boundaries/country-codes.mts`). The slug is made
from the name: lowercase, accents removed, `&` as `and`, and every other run of
characters that are not letters or digits (apostrophes included) as one
hyphen, so "Côte d'Ivoire" is `cote-d-ivoire`. Slugs are in `countries.json`
and become addresses, so changing one later needs a redirect. `england` is
reserved for England.

## Attribution

Made with Natural Earth.
