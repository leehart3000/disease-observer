# Contributing to Disease Observer

Thank you for your interest in Disease Observer. This guide explains how
the project is set up and the conventions it follows.

## About the project

Disease Observer (https://disease.observer) is a website for infectious
disease surveillance. It shows maps and charts of cases for diseases such
as COVID-19, influenza, measles, malaria, cholera, dengue, mpox and
meningococcal disease.

The first version covers:

- 3 diseases and 1 or 2 data sources
- A map with a "cases within a circle" query and a heatmap
- One chart page

## Tech stack

- Next.js (App Router), React, TypeScript, Tailwind CSS
- Drizzle ORM and the `pg` driver, PostgreSQL with PostGIS (Neon in
  production)
- MapLibre GL and deck.gl, with base maps from OpenFreeMap or Protomaps
- Hand-built, accessible SVG for time-series charts (no charting library)
- ETL: TypeScript scripts using Drizzle, Zod and Turf.js, run on GitHub
  Actions scheduled workflows
- Testing: Vitest, React Testing Library and Playwright
- Code quality: ESLint, Prettier and TypeDoc
- Hosting: Vercel. CI: GitHub Actions.
- Dependency updates: Dependabot (see `.github/dependabot.yml`).
- Package manager: pnpm. Runtime: Node.js 24 (see `.node-version`).

The project does not use Mapbox, Leaflet, TimescaleDB or Google
Analytics. Please discuss any new major library or service before adding
it.

## Conventions

- Keep each change small and focused on one thing.
- Discuss new, removed or upgraded dependencies before making the change.
- Never commit secrets. Local values go in `.env.local`, which Git
  ignores. Keep `.env.example` up to date with placeholder values only.
- Write commit messages as a short summary line in the imperative mood,
  for example "Add map page". Add a body after a blank line if the change
  needs explaining.
- Use British English in documentation and user-facing text.
- Prefer simple, readable code with clear names. Add TSDoc comments to
  exported functions.

## Commands

Run these from the repository root:

- `pnpm install`: install dependencies.
- `pnpm dev`: start the development server at http://localhost:3000. It
  first builds the files that the map page loads (see
  [The map page](#the-map-page)).
- `pnpm build`: create a production build. It builds the same files first.
- `pnpm start`: serve the production build (run `pnpm build` first).
- `pnpm lint`: run ESLint.
- `pnpm typecheck`: generate the Next.js route types and run the
  TypeScript compiler without emitting files.
- `pnpm test:e2e`: run the Playwright end-to-end tests at desktop (1280 px)
  and iPhone SE (375 px) sizes. The site starts automatically from a
  production build: it runs `pnpm build` and `pnpm start` (or only
  `pnpm start` when `CI` is set, after `pnpm build`). Run
  `pnpm exec playwright install chromium` once first, or set
  `CHROMIUM_PATH` to use a Chromium you already have. The map page tests
  need the test database (see [End-to-end test database](#end-to-end-test-database)).
  Locally it runs two tests at a time (`workers` in `playwright.config.ts`),
  because the map tests wait for WebGL to draw and time out at random when
  the machine is overloaded; CI uses Playwright's default. The fixture
  dates come from the day they are loaded, so run `pnpm test:e2e:db` again
  after midnight.
- `pnpm test:e2e:db`: create and prepare the local test database
  `disease_observer_test` for the end-to-end tests. Safe to run more than
  once.
- `pnpm e2e:fixtures`: load the fixture observations into the test
  database. It refuses any other database.
- `pnpm boundaries:web` and `pnpm maplibre:worker`: build the files that
  the map page loads. `pnpm dev` and `pnpm build` run them for you.
- `pnpm icons`: rebuild `src/app/favicon.ico` and `src/app/apple-icon.png`
  from `public/brand/mark-light.svg`. It uses the same Chromium as the
  tests.
- `pnpm db:generate`, `pnpm db:migrate` and `pnpm db:seed`: work with the
  database (see [Database](#database)).

- `pnpm boundaries:prepare`: rebuild the England-only boundary files in
  `data/ons/` from the raw ONS downloads (see `data/ons/README.md`).
- `pnpm db:boundaries`: load those boundaries into the `areas` table. Run
  it after `pnpm db:seed`. It is safe to run more than once.
- `pnpm etl:ukhsa`: load UKHSA data (COVID-19 for England, the UKHSA
  regions and the local authorities, and measles for England and the
  regions) into the database. It needs `DATABASE_URL_UNPOOLED` and
  `pnpm db:seed` first. With no options it loads the current year (plus
  last year in January). `--from=YYYY` backfills COVID-19 from that year,
  `--limit=N` loads only the first N local authorities, and
  `--only=nation,region,lad` loads only those kinds of area, for example
  `--from=2023 --only=nation,region` to backfill England and the regions
  without reloading every local authority. The England and region series
  are always requested without age or sex breakdowns
  (`age=all&sex=all&stratum=default`), and the run refuses a series that
  still reports more than 2,000 rows. The command exits with an error if
  the run is marked failed.

Commands for unit tests, formatting and documentation will be added when
those tools are set up.

## Database

The schema is in `src/db/schema.ts`, and the server-side client is in
`src/db/index.ts` (it imports `server-only`, so client components cannot
use it). Migrations are generated into `drizzle/`. The first one is a
custom migration (`pnpm exec drizzle-kit generate --custom`) that creates
the PostGIS extension, so it runs before the tables.

Drizzle Kit writes the type of a `geography` column in quotes when a
migration adds a `geography` column or changes its type, and PostgreSQL
rejects that. Remove the quotes by hand before you apply the migration,
for example `"centroid" geography(Point,4326)`. CI fails if a migration
still contains a quoted `geography` type. Never edit a migration that has
already been applied, and never edit the snapshots in `drizzle/meta`.

App code (route handlers and server components) gets its database client
from `getDb` in `@/db`. Scripts that run outside Next.js, such as the seed
and the ETL, use `createDb` from `src/db/client.ts`, because `server-only`
stops them importing `@/db`. ESLint stops files in `src/app` and
`src/components` importing the client file.

- `pnpm db:generate`: generate a migration after changing the schema.
  Commit the new files in `drizzle/`.
- `pnpm db:migrate`: apply migrations to the database.
- `pnpm db:seed`: add the data sources and diseases. It is safe to run
  more than once.

Both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are needed to work with
the database. The app uses `DATABASE_URL` (Neon's pooled connection in
production). Migrations and the seed script use `DATABASE_URL_UNPOOLED`
(the direct connection). Because the pooler runs in transaction mode,
code must not rely on session state such as `SET`, advisory locks or
temporary tables.

For local development, the dev container has a Postgres 18 and PostGIS
3.6 database in a container called `db`. `.env.local` points both URLs at
it. `.env.local` holds local development values only: never put
production credentials in it. Production values are set in Vercel and
GitHub, and `.env.example` shows the variable names.

Check that the database is reachable at http://localhost:3000/api/health,
which returns the PostGIS library version.

The build, lint and type check must pass without `DATABASE_URL`, so
nothing may query the database at build time. Only the end-to-end tests use
a database (see below).

### End-to-end test database

The map page tests need data, so they use a separate database called
`disease_observer_test`, never the development one.

- Locally, run `pnpm test:e2e:db` once, and again whenever the schema
  changes. It creates the database in the same local `db` container (using
  the server and login in `.env.local`), runs the migrations, the seed and
  the boundary loader, and loads a small set of fixture observations (30
  local authorities for COVID-19, enough for a second page of the table, and
  the 9 regions for measles, plus 70 weeks of England values for both, and
  a weekly history for three local authorities for the chart, one with a
  missing week; dates are worked out from today). `pnpm test:e2e` then points the site at that
  database. Because of this, it starts its own server, so stop `pnpm dev`
  first.
- The fixture loader (`e2e/fixtures/load.mts`) deletes every observation
  in its database before it loads, so it refuses to run unless the host is
  local and the database is called exactly `disease_observer_test`. Never
  load fixtures into `disease_observer`.
- In CI, the end-to-end job has its own PostGIS service container, with
  the image pinned by digest like the actions. Dependabot does not update
  service images, so update the digest in `.github/workflows/ci.yml` by hand
  now and then, for example with
  `docker buildx imagetools inspect postgis/postgis:18-3.6`. The job builds
  the site with no database URL, then migrates, seeds, loads the boundaries
  and fixtures, and runs the tests.

## Site pages

The header and footer are in the root layout (`src/app/layout.tsx`), so
every page has them. The header links are listed in `NavLinks.tsx`.

- `/`, `/diseases` and `/diseases/[slug]` are generated from the diseases
  in the registry (name, summary and description). Adding a disease to the
  registry adds its card and its page. Their text and links do not need the
  database. An unknown disease slug gets a real 404 from `src/proxy.ts`,
  because with Cache Components the page cannot change the status once its
  shell is sent.
- Each card and disease page shows the disease's headline: the latest
  England value of its `headline` dataset, its period, a "Provisional" tag
  when the source may still revise it, and a sparkline of the last 26
  weekly values (`src/lib/data/headlines.ts`). The figure streams in, is
  cached for about a day like the map values, and says "No figure yet" if
  England has no data, or "Figure unavailable" if the database can't be
  read. The sparkline is an inline SVG hidden from screen readers, with a
  sentence for them.
- Each disease page also has a weekly line chart of England and the nine
  UKHSA regions since the date in the disease's `chart.since`
  (`src/components/charts/`, with the maths in `src/lib/chart-math.ts` and
  the data in `src/lib/data/series.ts`). It is hand-built SVG, drawn on the
  server and then at the size of its box. England is a thick line in the
  text colour and the regions are thin muted lines; ticking a region in the
  legend highlights it, drawn on top of England, in one of three colours
  (`--chart-1` to `--chart-3` in `globals.css`, checked together in both
  themes). The range starts on the last 12 months, with a choice of the
  whole series since `chart.since` (on the disease page it is not in the
  URL; see the chart view below), and the y axis always starts at zero.
  `LineChart.tsx` holds the controls (range and region checkboxes) and
  `LineChartPlot.tsx` the drawing, slider, readout and data table, which a
  second set of controls can reuse. Pointing at or touching the chart, or using
  the arrow, Page Up, Page Down, Home and End keys on it, moves a marker
  and shows that week's values. A "View data table" disclosure holds the
  same weeks as a table, newest first, paged like the map's table
  (`src/components/PageControls.tsx`).
- The disease page reads, from the top: the heading and introduction, the
  latest figure, the chart, the datasets (each with its `description` from
  the registry and a link to each of its views) and the sources.
- **Dataset pages.** Each dataset has its own page,
  `/diseases/<disease>/<dataset>` (what it shows, how to read it, a card for
  each view, and its sources), and a page for each view in its `views` list
  (a view is added to the list when its page is built, and the cards, the
  disease page's links and the sitemap follow).
  The disease page lists its datasets, with a link to each view. `/maps`
  lists every map, grouped by disease, and replaces "Map" in the header.
- **The chart view** (`…/chart`) exists for a dataset that lists `chart` in
  its `views`. The time range is in the address as `?range=all` (left out for
  the last 12 months); any other `range` is ignored. **The address is the only
  place the chart's state is kept.** The range (`useChartRange`) and the chosen
  areas (`AreaPicker`) are read from it with `useSearchParams` and nowhere else,
  and a choice rewrites it with `router.replace` (no history entry). The change
  shows at once through `useOptimistic`, which lasts only until the router has
  finished, so what is shown can't drift from the address, for example when
  Next.js restores a page that was visited before. Writes are built from
  `window.location.search`, which is always current, so the rest of the query
  is kept. What else the page shows depends on the dataset's `chart.mode`:
  - `all-areas` (few areas, such as measles by region): the disease page's
    chart (England and every region, tick up to three to highlight). Its
    series is the disease's headline dataset, so an `all-areas` dataset must
    be its disease's headline.
  - `pick-areas` (many areas, the COVID-19 local authorities): England is
    always drawn, and the visitor chooses up to three areas with `AreaPicker`
    (a chip with "Remove" for each choice, "Clear", and a labelled search box
    above a scrolling list of buttons, 18 rem high at most). The list shows
    every area under its UKHSA region's heading (`h3`; regions and names
    alphabetical, areas with no known region last) while the box is empty, and
    only the matches, under the same headings, as you type. One live line
    announces the count ("306 local authorities in 9 regions", "6 matches in 4
    regions"), and the box is described by it. Chosen areas leave the list. Enter
    in the box adds the first name that starts with the text, else the first in
    the list. At the limit the box and list are replaced by a message. The
    areas are in the address as `?areas=`, so the server loads the new
    areas' data. Each area keeps its place's colour (`--chart-1` to
    `--chart-3`, by the order chosen). Three is the most because only three
    colours pass the palette checks together (`MAX_COMPARED_AREAS` in
    `src/lib/series-compose.ts`). The codes are checked against the dataset's
    area index (`loadAreaIndex`) before anything is loaded: unknown, repeated
    and malformed codes are dropped, and only the first three valid ones are
    used. The index lists only the areas that have rows (eleven local
    authorities have none in the feed). The map's readout and each row of the
    table page have a "Chart this area" link (`chartAreaHref` in `routes.ts`).
  - The series for one area is `loadAreaSeries` (`src/lib/data/areas.ts`),
    cached with one entry for each area, never for each combination, so the
    cache holds about 330 small entries however the areas are mixed. England's
    weeks are the chart's weeks, and a week an area has no row for is "no
    figure". `LineChart` (the regions' controls) and `AreaChart` (the picker)
    both draw with `LineChartPlot`.
- **Pages read `params` inside `Suspense`.** The disease, dataset, map, table
  and chart pages are a plain function that wraps an async one in
  `<Suspense fallback={<PageFallback />}>`, so the route's shared App Shell
  (what a link prefetches) holds nothing that belongs to one address. Every
  address is still built ahead of time (`generateStaticParams`), so a direct
  visit gets the whole page, with its heading and breadcrumb, in the HTML.
  Without this, `next dev` warns "`params` or `searchParams` accessed outside
  of `<Suspense>`". Unknown addresses are still a real 404 from `src/proxy.ts`.
- **Server code cannot import values from a `"use client"` file** (it gets a
  reference, not the value). Share constants through a file with no
  directive, such as `src/lib/series-compose.ts`.
- **Moving between views.** The map and table pages show a strip of links to
  the dataset's views (`ViewTabs.tsx`, from the `views` list; nothing is
  shown for fewer than two). They are page links with `aria-current="page"`,
  not ARIA tabs. The chosen areas (`?areas=`) are kept in every link,
  including a pin made after the page loaded, so the strip reads the
  address in the browser (before that, the links are plain ones).
- **The table page** (`…/table`) shows the same cached values as the map in
  the shared `ValuesTable`, with search, sorting and paging, and no map code.
  Each row has a "View on map" link (under the area's name on a phone, in a
  column of its own otherwise) to the map with that area pinned, and the
  rows for the areas in `?areas=` are highlighted. On the map page the same
  table has a line above it, "Select an area to pin it on the map.", and each
  area's name is a button with a map pin that pins it.
- **Links to other websites** all use `ExternalLink` (`src/components/`): they
  open in a new tab with `rel="noopener noreferrer"`, show a small "opens in
  a new tab" icon joined to the last word of the text, and have the hidden
  words "(opens in a new tab)". The map's attribution box is built by
  MapLibre from the base map's style, so its links are given the same
  treatment by script (`decorateExternalAnchor` in `src/lib/external-link.ts`,
  which holds what both share). Do not write `target="_blank"` links by hand.
- Next.js keeps the page you navigated from, hidden, so after a link
  inside the site both pages can be in the document. In tests, use role
  queries (which skip hidden elements), not label or text queries.
- `src/proxy.ts` runs only for `/map` and `/diseases/…` addresses (its
  matcher). `decideRoute` in `src/lib/routing.ts` makes the decision: an
  unknown disease, dataset or view is a 404 (a Cache Components page cannot
  change its status once its shell is sent), and `/map` redirects to the
  dataset's map page. A request that carries on is marked with an
  `x-disease-checked` header so the tests can see where it ran.
- A trail of two or more steps is shown as a breadcrumb (`Breadcrumbs.tsx`:
  a `nav` named "Breadcrumb" with an ordered list, the current page last
  and marked `aria-current="page"`, plus the same trail as `BreadcrumbList`
  JSON-LD). That means the disease pages (Diseases > COVID-19) and the
  dataset pages below them (… > Rate by local authority > Map). Pages with
  a single step, such as Diseases, Maps, About and Sources, have none, and
  there is no "Home" step because the wordmark is the home link.
- Page addresses are built in one place, `src/lib/datasets/routes.ts`, from
  the registry: each dataset has a `slug` and a short `name` (for example
  `rate-by-local-authority` and "Rate by local authority"), a `howToRead`
  text, and a `views` list of the views that have a page. `sitePaths()`
  lists every page for `/sitemap.xml` (`src/app/sitemap.ts`), so a new
  disease, dataset or view is in the sitemap without more work.
  `/robots.txt` (`src/app/robots.ts`) allows everything except `/api/` and
  names the sitemap.
- Every page has a canonical link to its own address with no query string
  (`canonicalFor` in `src/lib/seo.ts`; `SITE_URL` is the one place that
  knows the site's address). States such as `?d=…` are views of the same
  page, not separate pages to index.
- `/sources` and the sources on each disease page list only the sources
  that a registry dataset uses (`sourceSlugs`), read from the `sources`
  table, plus the base map credit in `src/lib/credits.ts`. If the table
  can't be read, they show "Sources unavailable".
- `/about` is static text.

## The map page

Each dataset has a map page, such as
`/diseases/covid-19/rate-by-local-authority/map`, that shows its latest
values (the latest COVID-19 rate by local authority, or the latest complete
week of measles cases by region) on an OpenFreeMap base map drawn with
MapLibre GL JS. `/maps` lists every map. The old `/map` and `/map?d=…`
addresses redirect permanently (308) to the right page (see `src/proxy.ts`
and `decideRoute` in `src/lib/routing.ts`), so shared links keep working.

- **The dataset registry** (`src/lib/datasets/registry.ts`) lists the
  diseases and the datasets that the map can show: each dataset's id, label,
  metric, unit, column heading, period rules, boundary file, the map's
  opening box and the box it can be moved within (`map.bounds` and
  `map.maxBounds`, as `[[west, south], [east, north]]`; the second must
  contain the first, which `e2e/registry.spec.ts` checks), colour scale
  and sources. The dataset pages, the lists, the table, the legend and the
  credits all read from it, so adding a dataset is mostly adding an entry to
  `DATASETS`
  (and the disease to `DISEASES`, if it is new). A disease appears only when
  the site has data for it. The registry is erasable TypeScript with no `@/`
  imports, so scripts can import it too.
- **The dataset is in the path** (`…/measles/cases-by-region/map`), and an
  unknown disease, dataset or view is a real 404 from the proxy. The checked
  period is the only other argument of the cached data function, so the
  cache stays small. There is no dataset picker: choosing another dataset is
  a link (from `/maps`, the disease page or the breadcrumb), so the map is
  created again on the new page.
- **The period is in the address** as `?p=12w` or `?p=ytd` (left out for the
  latest). A dataset lists the periods it offers in `periods`: weekly counts
  (measles) offer the latest week, the last 12 weeks added up, and the year
  to date added up (the weeks that start in the same calendar year as the
  latest complete week); a rate (COVID-19) cannot be added up, so it offers
  the latest only and shows its `periodNote` instead of the picker. One query
  (`queryMapValues` in `src/lib/data/map-values.ts`) serves all three, and a
  total is provisional if any week in it is. An area with no row for some
  week is added up from the weeks it has, and the map readout and the table
  say "11 of 12 weeks reported". An unknown or unoffered `p` is ignored, and
  the old `/map?d=…&p=…` redirect keeps a period the dataset offers. The
  map and table pages show the picker (`PeriodPicker`), the links between
  views keep the period, and the chart does not (it shows every week).
- **The pinned area is in the address** as `?areas=E06000001`. Pinning or
  unpinning rewrites it with `history.replaceState` (no page load, no
  history entry). The pin is read from the address with `useSearchParams` and
  nowhere else (with an optimistic value so it shows at once), so a pinned
  area in the address is pinned on load and a page that Next.js restores
  without `?areas=` has no pin. Codes
  that are not shaped like an area code, or are not in the dataset, are
  ignored. The page's canonical link has no query string.
- MapLibre is only loaded in the browser, and only on this page.
- The boundaries come from the committed files in `data/ons/`.
  `pnpm boundaries:web` turns them into `public/boundaries/` (ignored by
  Git): codes and names follow UKHSA (see `scripts/boundaries/ukhsa-codes.mts`),
  and coordinates are rounded to 5 decimal places. They are static files
  with long cache headers, so no geometry is queried from the database.
- `pnpm maplibre:worker` copies MapLibre's web worker to `public/maplibre/`
  (ignored by Git), because the bundler moves the library and it can no
  longer find the worker beside it.
- The values come from `src/lib/data/map-values.ts`, cached with `"use
  cache: remote"` and `cacheLife("days")`, one entry per dataset. **New data
  appears on the map within about a day of the ETL**, because the cache
  refreshes in the background once a day. `loadWithFallback` in
  `src/lib/data/load.ts` is the pattern for every data function: if the
  cache fails or is slow, the page queries the database directly, and if
  that fails too it shows "Data unavailable" and the rest of the page (the
  breadcrumb and heading) still works.
- The base map follows the theme toggle, switching between OpenFreeMap's
  positron (light) and dark styles without reloading the page. The style
  files are not edited: `transformStyle` (in `ChoroplethMap.tsx`) raises
  the contrast of the place labels so they read over the coloured areas.
  Our colours for MapLibre's attribution box are in
  `src/components/map/map.css`.
- Pointing at an area previews it. Clicking or tapping it, or choosing its
  name in the table, pins it so the readout stays. Escape, clicking empty
  map or choosing it again unpins it.
- The full screen button expands one wrapper that holds the map, the key
  and the readout (`useExpandable.ts`). Where the Fullscreen API works on a
  `div`, it uses that. iPhone Safari only supports it for video, so there it
  uses a CSS mode (`.map-frame[data-mode="css"]` in `map.css`): fixed to the
  viewport, above everything, with the page behind it unscrollable and
  `inert`. Escape or the same button leaves either mode and focus returns to
  the button. The e2e tests cover the CSS mode by removing the API before
  the page loads. In both modes the map fills the screen edge to edge, with
  no padding, border, rounding or shadow of our own: the only space is the
  device's safe area (`env(safe-area-inset-*)`), and the key, readout and
  MapLibre's buttons sit inside it.
- The key can be collapsed to a slim bar (a colour strip with the lowest
  and highest values). In full screen on a screen narrower than 640 px it
  starts collapsed, and otherwise expanded. Once the visitor chooses, that
  choice is kept for the rest of the page visit, in and out of full screen
  (it is not stored in the browser). On a narrow full screen map, the
  readout is compact, and moves to the bottom if the pinned area would be
  under it.
- The table can be searched, sorted and paged (25 rows by default), and
  choosing an area's name in it pins the area. The credits under it are only
  those of the dataset that is shown.
- The server renders the first page of the table into the HTML. React
  streams the data-dependent part of the page, and a script reveals it, so
  a browser with JavaScript turned off shows only "Loading the map".
  Fixing that would mean reading the database at build time, which is not
  allowed.

### Running migrations on Neon

The "Database: migrate and seed" workflow applies the migrations and the
seed to a Neon database. It only runs from `main`, and only when you start
it by hand:

1. Open the Actions tab on GitHub, choose "Database: migrate and seed" and
   select "Run workflow" on `main`.
2. Choose the `target`. Try `db-dev` first.
3. `db-prod` waits for a required reviewer to approve it before it runs.

Each target is a GitHub environment that holds its own
`DATABASE_URL_UNPOOLED` secret. The workflow passes it only to the
migrate and seed steps.

### Running the UKHSA ETL on GitHub

The "ETL: UKHSA" workflow runs `pnpm etl:ukhsa` every Friday at 07:37 UTC
against the `etl-prod` environment, in the default mode (the current
year). A failed run shows as failed in GitHub and sends the usual failure
email.

To run it by hand, open the Actions tab, choose "ETL: UKHSA" and select
"Run workflow" on `main`:

- `target`: `db-dev` or `etl-prod`.
- `from`: a four-digit year to backfill COVID-19 from, or empty for the
  default mode.
- `limit`: a whole number to load only the first N local authorities, or
  empty for all of them.
- `only`: a comma-separated list of `nation`, `region` and `lad` (no
  spaces), or empty for all. To backfill England and the regions, use
  `from` = `2023` and `only` = `nation,region`.

Test on `db-dev` with a small `limit` first, for example 5. A backfill
makes about 600 requests for each year, so it can take a long time.

GitHub pauses scheduled workflows in a public repository after 60 days
without commits. If that happens, re-enable the workflow from the Actions
tab.
