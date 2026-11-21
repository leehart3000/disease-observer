/**
 * Copies MapLibre's web worker into `public/maplibre/` (ignored by Git), so
 * the map page can load it from our own site.
 *
 * MapLibre looks for its worker next to its own script. Once the bundler
 * has combined the script into a chunk, the worker is no longer there, so
 * the page tells MapLibre where to find the copy (`setWorkerUrl`).
 *
 * Rebuilt by `pnpm dev` and `pnpm build`. Run with `pnpm maplibre:worker`.
 */
import { copyFileSync, mkdirSync } from "node:fs";

const SOURCE = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
const OUTPUT_DIR = "public/maplibre";

mkdirSync(OUTPUT_DIR, { recursive: true });
copyFileSync(SOURCE, `${OUTPUT_DIR}/maplibre-gl-worker.mjs`);
console.log(`${OUTPUT_DIR}/maplibre-gl-worker.mjs copied from ${SOURCE}`);
