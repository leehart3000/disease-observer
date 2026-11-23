# Disease Observer

**Maps and charts for infectious disease surveillance.**
Live at **<https://disease.observer>**.

Disease Observer brings public figures on infectious diseases together in one
place, so that anyone can see what is being reported and where. It shows
the latest figures on maps, how they have changed over time in charts, and
every figure in a table.

## What it does

- **Maps.** A map for each dataset, coloured by the latest figure for each area:
  England's COVID-19 rate by local authority, measles cases by region, and
  hospital admissions for influenza, RSV and COVID-19 by US state. Pin an area
  to read its figure, move to Alaska or Hawaii, and go full screen.
- **Charts.** Weekly line charts, drawn as hand-built SVG, that compare a place
  with up to three of its areas. A slider, the keyboard or a touch moves through
  the weeks, and the same numbers are in a table underneath.
- **Tables.** Every figure, searchable, sortable and paged, with links to the
  map and the chart.
- **Locations.** A page for each place (England, the United States) with every
  disease that has data for it and its latest figure.
- **Honest numbers.** Recent weeks are marked provisional, missing weeks are
  shown as missing, and each dataset says what to know before relying on it.
- **Shareable.** The chosen areas and period are in the address, and every page
  has a sharing picture.

## Where the data comes from

| Data | Source | Licence |
| --- | --- | --- |
| COVID-19 and measles in England | [UKHSA data dashboard](https://ukhsa-dashboard.data.gov.uk/) | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) |
| English area boundaries | [ONS Open Geography Portal](https://geoportal.statistics.gov.uk/) | Open Government Licence v3.0 (contains OS data © Crown copyright and database right 2022) |
| Influenza, RSV and COVID-19 hospital admissions in the United States | CDC National Healthcare Safety Network (NHSN), [data.cdc.gov](https://data.cdc.gov/d/ua7e-t2fy) | [Public Domain U.S. Government](https://www.usa.gov/government-works) |
| Country and US state boundaries | [Natural Earth](https://www.naturalearthdata.com/) | Public domain |
| Base map | [OpenFreeMap](https://openfreemap.org/), OpenMapTiles and OpenStreetMap contributors | See the map's credit |

The site's own [Sources page](https://disease.observer/sources) lists the
credits as they are shown to visitors. `data/ons/README.md` and
`data/natural-earth/README.md` say how the boundary files were made.

## How it is built

- **Next.js** (App Router, Cache Components), React, TypeScript and Tailwind CSS.
  Pages are prerendered from a registry of diseases and datasets
  (`src/lib/datasets/registry.ts`), so adding a dataset is mostly adding an
  entry. The registry also drives the sitemap, the breadcrumbs, the sharing
  pictures and the list of places.
- **A scheduled ETL.** TypeScript scripts (`scripts/etl/`) run on **GitHub
  Actions** each week, check the data with Zod, and write idempotent upserts into
  **Neon** (PostgreSQL with PostGIS) through Drizzle ORM. Each run is recorded.
- **Cached pages on Vercel.** Pages are static apart from the figures, which
  stream in from cached queries that refresh about once a day, with a direct
  database query as a fallback and a clear message if both fail. Nothing
  queries the database when the site is built.
- **Static boundaries.** Area boundaries are files built from the committed
  ONS and Natural Earth data, with long cache headers: no geometry is queried
  from the database.
- **MapLibre GL JS** draws the maps, loaded only on the pages that have one.
- **Hand-built SVG charts**, with no charting library, drawn on the server and
  then at the size of their box.

## Accessibility and testing

- **Playwright** end-to-end tests run at desktop and phone sizes against a
  production build and a throwaway PostGIS database, covering the maps, charts,
  tables, addresses, redirects and 404s.
- **axe-core** checks every page in the sitemap, in the light theme and, for one
  page of each kind, the dark theme, and fails on serious or critical issues.
- **A standalone smoke test** (`pnpm smoke:standalone`) runs the site from
  Next.js's standalone build output, to catch a file that the code reads at run
  time but the build output lacks.
- Charts and maps have keyboard and screen reader equivalents (a slider and a
  data table for each chart, a table and buttons for each map), and the chart
  colours are checked together in both themes.

## Running it locally

You need Node.js 24 (see `.node-version`), pnpm and a PostgreSQL database with
PostGIS (the project is developed against PostgreSQL 18 with PostGIS 3.6).

```bash
pnpm install
cp .env.example .env.local        # then put your database URLs in it
pnpm db:migrate && pnpm db:seed && pnpm db:boundaries
pnpm etl:ukhsa --from=2023        # and: pnpm etl:cdc-nhsn
pnpm dev                          # http://localhost:3000
```

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`
(after `pnpm test:e2e:db`) and `pnpm smoke:standalone`. The conventions and the
details of each part are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Licences

- **Code:** [GNU Affero General Public License v3.0 only](LICENSE)
  (AGPL-3.0-only). If you run a modified version on a server, you must offer its
  source code to the people who use it.
- **Data:** each source's own terms, listed above, on the
  [Sources page](https://disease.observer/sources) and in `data/*/README.md`.
  The data is not covered by the code's licence.
- **Fonts:** IBM Plex Sans and IBM Plex Mono, under the
  [SIL Open Font License 1.1](src/assets/fonts/IBM-Plex-Sans-OFL-LICENSE.txt).

Copyright (C) 2026 Lee Hart
