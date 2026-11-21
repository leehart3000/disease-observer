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
  and iPhone SE (375 px) sizes. The site starts automatically with
  `pnpm dev` (or `pnpm start` when `CI` is set, after `pnpm build`). Run
  `pnpm exec playwright install chromium` once first, or set
  `CHROMIUM_PATH` to use a Chromium you already have. The map page tests
  need the test database (see [End-to-end test database](#end-to-end-test-database)).
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
- `pnpm etl:ukhsa`: load UKHSA data (COVID-19 by local authority and
  measles by region) into the database. It needs `DATABASE_URL_UNPOOLED`
  and `pnpm db:seed` first. With no options it loads the current year
  (plus last year in January). `--from=YYYY` backfills COVID-19 from that
  year, and `--limit=N` loads only the first N local authorities. The
  command exits with an error if the run is marked failed.

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
  the 9 regions for measles, with dates
  worked out from today). `pnpm test:e2e` then points the site at that
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
  database.
- `/sources` and the sources on each disease page list only the sources
  that a registry dataset uses (`sourceSlugs`), read from the `sources`
  table, plus the base map credit in `src/lib/credits.ts`. If the table
  can't be read, they show "Sources unavailable".
- `/about` is static text.

## The map page

The map page (`/map`) shows the latest COVID-19 rate by local authority and
the latest complete week of measles cases by region, on an OpenFreeMap base
map drawn with MapLibre GL JS.

- **The dataset registry** (`src/lib/datasets/registry.ts`) lists the
  diseases and the datasets that the map can show: each dataset's id, label,
  metric, unit, column heading, period rules, boundary file, colour scale
  and sources. The picker, the table, the legend and the credits all read
  from it, so adding a dataset is mostly adding an entry to `DATASETS`
  (and the disease to `DISEASES`, if it is new). A disease appears only when
  the site has data for it. The registry is erasable TypeScript with no `@/`
  imports, so scripts can import it too.
- **The dataset is in the URL:** `/map?d=measles-cases`. The page checks the
  value against the registry, and shows the default dataset if it is
  missing or unknown. The checked values are the only arguments of the
  cached data function, so the cache stays small.
- Choosing a dataset in the picker navigates without reloading the page,
  and the map itself is not recreated.
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
  that fails too it shows "Data unavailable" (with the dataset picker still
  there) and the rest of the page still works.
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
- The table can be searched, sorted and paged (25 rows by default). The
  credits under it are only those of the dataset that is shown.
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

Test on `db-dev` with a small `limit` first, for example 5. A backfill
makes about 600 requests for each year, so it can take a long time.

GitHub pauses scheduled workflows in a public repository after 60 days
without commits. If that happens, re-enable the workflow from the Actions
tab.
