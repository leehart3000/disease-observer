import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { MARK_SVG } from "../src/lib/og-mark.ts";

/**
 * Checks on how the site's code reads files, so that a file that a host's file
 * tracing leaves out cannot take the site down again.
 *
 * What happened: the sharing pictures read their fonts from `node_modules` at
 * the start of the picture module. Next.js loads that module to render every
 * page (to read the `alt` and `size` the picture route exports), and Vercel
 * did not have those files, so every page failed. The rules, checked on every
 * file in `src/`:
 *
 * 1. Nothing reads from `node_modules` or from `process.cwd()`: those paths are
 *    not what the host runs from.
 * 2. Nothing has a top-level `await`: it runs when the module loads, which for
 *    a picture module is while a page renders.
 * 3. Only the picture code reads files at all, and it reads them with
 *    `new URL("…", import.meta.url)`, so the bundler builds the file in.
 *
 * `pnpm smoke:standalone` (run in CI) checks the same thing on the built
 * output. No browser is used here.
 */

/** Every `.ts`, `.tsx` and `.mts` file under a folder. */
function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts)$/.test(entry.name) ? [path] : [];
  });
}

/** The code of a file without its comments (a rough pass: enough for these rules). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** The ways a file breaks the rules, as short messages. */
export function problemsIn(source: string): string[] {
  const code = withoutComments(source);
  const problems: string[] = [];
  if (/process\.cwd\(\)/.test(code)) problems.push("uses process.cwd()");
  if (/node_modules/.test(code)) problems.push("mentions node_modules");
  if (/^(?:const|let|var)\s[^\n]*=\s*await\s|^await\s/m.test(code)) problems.push("has a top-level await");
  return problems;
}

/** Files that read from disk, with what they must do. */
const MAY_READ_FILES = ["src/lib/og-image.tsx"];

/**
 * Files that name `node_modules` for the bundler, not for the running site:
 * `next/font/local` reads its font files when the site is built and puts
 * copies in the build output (`.next/static/media`).
 */
const BUILD_TIME_ONLY = ["src/app/fonts.ts"];
const readsFiles = (source: string) => /node:fs|from "fs"|readFile|readdir|createReadStream/.test(withoutComments(source));

test.describe("the site's code and files it reads at run time", () => {
  const files = sourceFiles("src");

  test("nothing in src reads from node_modules or the working folder, or awaits at the top of a module", () => {
    expect(files.length).toBeGreaterThan(50);
    const found = files
      .filter((file) => !BUILD_TIME_ONLY.includes(file))
      .flatMap((file) => problemsIn(readFileSync(file, "utf8")).map((problem) => `${file} ${problem}`));
    expect(found).toEqual([]);
  });

  test("the files that name node_modules do it for next/font, which builds the fonts in", () => {
    for (const file of BUILD_TIME_ONLY) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain('from "next/font/local"');
      expect(readsFiles(source), file).toBe(false);
      expect(problemsIn(source), file).toEqual(["mentions node_modules"]);
    }
  });

  test("only the picture code reads files, and it builds them in with new URL(..., import.meta.url)", () => {
    const readers = files.filter((file) => readsFiles(readFileSync(file, "utf8")));
    expect(readers).toEqual(MAY_READ_FILES);

    const picture = readFileSync("src/lib/og-image.tsx", "utf8");
    // Every file it reads is written in the read itself, so the bundler sees it.
    const reads = [...picture.matchAll(/readFile\(([^\n]*)\)/g)].map((match) => match[1]);
    expect(reads.length).toBeGreaterThanOrEqual(2);
    for (const read of reads) expect(read).toContain("new URL(");
    for (const read of reads) expect(read).toContain("import.meta.url");
    // The read is in a cached function that is called when a picture is made, not when the module loads.
    expect(picture).toMatch(/async function loadFonts\(\)[^\n]*\{\n\s*"use cache";/);
  });

  test("the fonts that the picture code names are in the repository, with their licence", () => {
    const picture = readFileSync("src/lib/og-image.tsx", "utf8");
    const named = [...picture.matchAll(/\.\.\/assets\/fonts\/([\w.-]+\.woff)/g)].map((match) => match[1]);
    expect([...new Set(named)].sort()).toEqual([
      "ibm-plex-sans-latin-400-normal.woff",
      "ibm-plex-sans-latin-500-normal.woff",
    ]);
    const present = readdirSync("src/assets/fonts");
    for (const name of named) expect(present, name).toContain(name);
    const licence = readFileSync("src/assets/fonts/IBM-Plex-Sans-OFL-LICENSE.txt", "utf8");
    expect(licence).toContain("SIL Open Font License");
  });

  test("the mark in the picture code is the same as the mark file", () => {
    expect(MARK_SVG.trim()).toBe(readFileSync("public/brand/mark-light.svg", "utf8").trim());
  });
});

test.describe("the check itself", () => {
  test("flags the code that took production down", () => {
    const broken = `
      import { readFile } from "node:fs/promises";
      import { join } from "node:path";
      const fontFiles = join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans/files");
      const [regular, medium] = await Promise.all([
        readFile(join(fontFiles, "ibm-plex-sans-latin-400-normal.woff")),
        readFile(join(fontFiles, "ibm-plex-sans-latin-500-normal.woff")),
      ]);
    `;
    expect(problemsIn(broken)).toEqual(["uses process.cwd()", "mentions node_modules"]);
    expect(problemsIn(`const font = await readFile(new URL("./a.woff", import.meta.url));`)).toEqual([
      "has a top-level await",
    ]);
    expect(problemsIn(`await readFile(new URL("./a.woff", import.meta.url));`)).toEqual(["has a top-level await"]);
  });

  test("does not flag an await inside a function, or the words in a comment", () => {
    const fine = `
      // Not from node_modules, and not process.cwd().
      /* const x = await y */
      async function load() {
        const font = await readFile(new URL("./a.woff", import.meta.url));
        return font;
      }
    `;
    expect(problemsIn(fine)).toEqual([]);
  });
});
