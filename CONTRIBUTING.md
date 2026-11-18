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
- Drizzle ORM, PostgreSQL with PostGIS (Neon in production)
- MapLibre GL and deck.gl, with base maps from OpenFreeMap or Protomaps
- ECharts for time-series charts
- ETL: TypeScript scripts using Drizzle, Zod and Turf.js, run on GitLab
  scheduled pipelines
- Testing: Vitest, React Testing Library and Playwright
- Code quality: ESLint, Prettier and TypeDoc
- Hosting: Vercel. CI: GitLab CI.
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

Commands for tests, formatting and documentation will be added when those
tools are set up.
