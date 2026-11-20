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
- ECharts for time-series charts
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
- `pnpm dev`: start the development server at http://localhost:3000.
- `pnpm build`: create a production build.
- `pnpm start`: serve the production build (run `pnpm build` first).
- `pnpm lint`: run ESLint.
- `pnpm typecheck`: generate the Next.js route types and run the
  TypeScript compiler without emitting files.
- `pnpm test:e2e`: run the Playwright end-to-end tests at desktop (1280 px)
  and iPhone SE (375 px) sizes. The site starts automatically with
  `pnpm dev` (or `pnpm start` when `CI` is set, after `pnpm build`). Run
  `pnpm exec playwright install chromium` once first, or set
  `CHROMIUM_PATH` to use a Chromium you already have.
- `pnpm icons`: rebuild `src/app/favicon.ico` and `src/app/apple-icon.png`
  from `public/brand/mark-light.svg`. It uses the same Chromium as the
  tests.
- `pnpm db:generate`, `pnpm db:migrate` and `pnpm db:seed`: work with the
  database (see [Database](#database)).

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

CI does not use a database yet. The build, lint, type check and end-to-end
tests must pass without `DATABASE_URL`, so nothing may query the database
at build time.

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
