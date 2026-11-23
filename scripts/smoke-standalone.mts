/**
 * Starts the site from Next.js's standalone build output and requests pages
 * and sharing pictures, to catch a file that the code reads at run time but
 * that the build output does not have. That is what broke production once: a
 * font was read from `node_modules`, which the host's traced files did not
 * have, and every page failed (Next.js loads the picture code to render any
 * page, so a font read at the start of that module failed them all).
 *
 * The standalone output (`.next/standalone`) holds only the files that Next.js
 * built and traced, with no source folder, which is what a serverless host
 * has when it runs the site. It runs here in two rounds:
 *
 * 1. As built. Every page and picture must work, including pictures that are
 *    made at run time (their made files are deleted first, so the server must
 *    make them from the fonts in the output).
 * 2. With the fonts deleted. Every page must still work, and only a picture
 *    that has to be made at run time may fail: a picture can fail on its own,
 *    but a page never.
 *
 * Run with `pnpm smoke:standalone`, which first builds with `NEXT_STANDALONE=1`
 * (the normal build is not changed). There is no database: the pages render
 * with their data sections saying the figures are unavailable.
 *
 * Erasable TypeScript only.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const STANDALONE = ".next/standalone";
const ASSETS = join(STANDALONE, ".next/server/assets");
const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;

/** What to request, and what a good answer looks like. */
const PAGES: Array<{ path: string; status: number; text: string }> = [
  { path: "/", status: 200, text: "Maps and charts for infectious disease surveillance" },
  { path: "/diseases", status: 200, text: "Diseases" },
  { path: "/diseases/influenza", status: 200, text: "Influenza" },
  { path: "/diseases/influenza/hospital-admissions-by-state", status: 200, text: "Things to know" },
  { path: "/diseases/influenza/hospital-admissions-by-state/map", status: 200, text: "Influenza hospital admissions by state, United States" },
  { path: "/diseases/influenza/hospital-admissions-by-state/chart", status: 200, text: "Influenza hospital admissions by state, United States" },
  { path: "/diseases/covid-19/rate-by-local-authority/table", status: 200, text: "COVID-19 rate by local authority" },
  { path: "/locations", status: 200, text: "Locations" },
  { path: "/locations/england", status: 200, text: "England" },
  { path: "/maps", status: 200, text: "Maps" },
  { path: "/sources", status: 200, text: "Sources" },
  { path: "/about", status: 200, text: "About" },
  { path: "/no-such-page", status: 404, text: "This page could not be found." },
];

/** Pictures that the build makes. The first three are also deleted, so the server makes them. */
const IMAGES = [
  "/opengraph-image",
  "/diseases/influenza/opengraph-image",
  "/diseases/influenza/hospital-admissions-by-state/opengraph-image",
  "/twitter-image",
  "/diseases/rsv/twitter-image",
  "/diseases/influenza/hospital-admissions-by-state/twitter-image",
];
const MADE_AT_BUILD = IMAGES.slice(0, 3).map((path) => `.next/server/app${path}`);

/** Every file under a folder whose name ends with `suffix`. */
function filesEndingWith(folder: string, suffix: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return filesEndingWith(path, suffix);
    return entry.name.endsWith(suffix) ? [path] : [];
  });
}

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

/** A running server and what it has printed. */
type Server = { process: ChildProcess; output: () => string };

function startServer(): Server {
  const child = spawn("node", ["server.js"], {
    cwd: STANDALONE,
    env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1", DATABASE_URL: "", DATABASE_URL_UNPOOLED: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  return { process: child, output: () => output };
}

/** Waits until the server answers, up to a minute. */
async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(`${BASE}/about`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("The server did not start");
}

/** Stops a server and waits until the port is free. */
async function stopServer(server: Server) {
  server.process.kill();
  await new Promise((resolve) => server.process.once("exit", resolve));
}

/** Checks every page. A page must work whatever has happened to the pictures. */
async function checkPages(round: string) {
  for (const { path, status, text } of PAGES) {
    const response = await fetch(`${BASE}${path}`);
    const body = await response.text();
    if (response.status !== status) fail(`${round}: ${path}: expected ${status}, got ${response.status}`);
    else if (!body.includes(text)) fail(`${round}: ${path}: the page does not say "${text}"`);
    else console.log(`ok  ${response.status}  ${path}`);
  }
}

/** Fetches a picture, and says whether it is a real PNG. */
async function fetchPicture(path: string) {
  const response = await fetch(`${BASE}${path}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const isPng = bytes.subarray(1, 4).toString("latin1") === "PNG";
  return { status: response.status, bytes: bytes.length, ok: response.status === 200 && isPng && bytes.length > 10_000 };
}

if (!existsSync(join(STANDALONE, "server.js"))) {
  console.error(`${STANDALONE}/server.js is missing. Run: pnpm smoke:standalone`);
  process.exit(1);
}

// The fonts are built into the output (`.next/server/assets`), not left to file tracing to
// find in the source folder or in `node_modules`.
const fonts = existsSync(ASSETS) ? filesEndingWith(ASSETS, ".woff") : [];
console.log(`Fonts in ${ASSETS}: ${fonts.map((font) => font.split("/").pop()).join(", ") || "none"}`);
for (const weight of ["400", "500"]) {
  if (!fonts.some((font) => font.includes(`ibm-plex-sans-latin-${weight}-normal`))) {
    fail(`The standalone output has no IBM Plex Sans ${weight} font in .next/server/assets`);
  }
}

// A host's file tracing can leave out files that code reads from `node_modules`, and
// the traced output here happens to have them (Next.js traces the fonts that the code
// names). The running site needs no font from `node_modules`: the page fonts are built
// into `.next/static/media` and the picture fonts into `.next/server/assets`. So delete
// every font file under `node_modules` in the output. Code that reads one from there, at
// the start of a module or anywhere else, then fails here as it did in production.
const packageFonts = [".woff", ".woff2"].flatMap((suffix) =>
  existsSync(join(STANDALONE, "node_modules")) ? filesEndingWith(join(STANDALONE, "node_modules"), suffix) : [],
);
for (const font of packageFonts) rmSync(font);
console.log(`Deleted ${packageFonts.length} font file(s) from node_modules in the output: the site must not need them`);

// Make the server make some pictures at run time, as a host does for one that is not made yet.
for (const made of MADE_AT_BUILD) {
  for (const extension of [".body", ".meta"]) rmSync(join(STANDALONE, `${made}${extension}`), { force: true });
}

// Round 1: as built.
console.log("\nRound 1: as built");
let server = startServer();
try {
  await waitForServer();
  await checkPages("round 1");
  for (const path of IMAGES) {
    const picture = await fetchPicture(path);
    if (!picture.ok) fail(`round 1: ${path}: expected a PNG picture, got ${picture.status} (${picture.bytes} bytes)`);
    else console.log(`ok  ${picture.status}  ${path}  (${picture.bytes} bytes)`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await stopServer(server);
}

// Round 2: with the fonts deleted, as if the host had left them out. A picture that was
// not made in round 1 has to be made now, and cannot be.
console.log("\nRound 2: with the fonts deleted");
for (const font of fonts) rmSync(font);
const UNMADE = "/diseases/rsv/opengraph-image";
for (const extension of [".body", ".meta"]) {
  rmSync(join(STANDALONE, `.next/server/app${UNMADE}${extension}`), { force: true });
}
server = startServer();
try {
  await waitForServer();
  // Every page works: a page does not depend on the picture code at run time.
  await checkPages("round 2");
  // A picture that has to be made now fails, on its own. It must not take anything else with it.
  const picture = await fetchPicture(UNMADE);
  console.log(`${picture.ok ? "ok  " : "fail"} ${picture.status}  ${UNMADE} (made at run time, with no fonts: expected to fail)`);
  if (picture.ok) fail(`round 2: ${UNMADE} was made with no fonts, so this round does not test what it should`);
  await checkPages("round 2, after a picture failed");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await stopServer(server);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`);
  for (const message of failures) console.error(`  - ${message}`);
  const errors = server.output().split("\n").filter((line) => /error|ENOENT/i.test(line));
  if (errors.length > 0) console.error(`\nThe server said:\n${errors.slice(0, 12).join("\n")}`);
  process.exit(1);
}
console.log("\nThe standalone output serves every page, and a picture that fails does not affect them.");
