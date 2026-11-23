import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { MARK_SVG } from "./og-mark";

/**
 * The picture shown when a page of the site is shared (Open Graph and Twitter
 * cards): the mark, the site name and the page's title, on the site's colours,
 * in IBM Plex Sans. The images are made at build time (they read no database),
 * so they are plain files when the site is served.
 *
 * **Nothing here reads a file when the module is loaded.** Next.js loads an
 * image route's module whenever it renders any page of the site, to read the
 * `alt` and `size` the route exports, so a file read at the module's start
 * would run for every page, and fail every page if the file were missing. This
 * once took the whole site down (the fonts were read from `node_modules`, which
 * the host's file tracing had left out). The fonts are read by `renderOgImage`,
 * when a picture is made, from copies in `src/assets/fonts` that the bundler
 * builds in (see `loadFonts`). The mark is text (`og-mark.ts`).
 */

/** The size every card image uses (the usual 1.91 to 1). */
export const OG_SIZE = { width: 1200, height: 630 };

const MARK = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

/**
 * Reads the two fonts. It is called only when a picture is made, never when
 * the module loads, and its answer is cached, so the files are read once.
 *
 * - `new URL("…", import.meta.url)`, written in the `readFile` call itself, is
 *   how the bundler is told that this module uses a file: it copies the file
 *   into the build output (`.next/server/assets`) and points the URL at the
 *   copy, so the file is part of the build, not something that a host's file
 *   tracing has to find in the source folder or in `node_modules`. (The URL is
 *   turned into a path first, because `readFile` can refuse a URL object that
 *   the bundler made in another context.)
 * - `"use cache"` is what lets a picture be made at run time. With Cache
 *   Components, a route that reads a file that is not cached is refused ("used
 *   IO that was not cached"), which is why the Next.js examples read the font at
 *   the start of the module. That is not safe here (see the top of this file),
 *   so the read is cached instead.
 */
async function loadFonts(): Promise<{ regular: ArrayBuffer; medium: ArrayBuffer }> {
  "use cache";
  cacheLife("max");
  const [regular, medium] = await Promise.all([
    readFile(fileURLToPath(new URL("../assets/fonts/ibm-plex-sans-latin-400-normal.woff", import.meta.url))),
    readFile(fileURLToPath(new URL("../assets/fonts/ibm-plex-sans-latin-500-normal.woff", import.meta.url))),
  ]);
  // Copies, as plain ArrayBuffers, which can be cached.
  return { regular: new Uint8Array(regular).buffer, medium: new Uint8Array(medium).buffer };
}

/** The site's colours in the light theme (see `globals.css`). */
const COLOURS = { paper: "#f3f5f8", ink: "#24303d", muted: "#5a6675", brand: "#2b5c9e", line: "#d7dde4" };

/**
 * Makes a card image.
 *
 * @param title - The page's title, large. Long titles are set smaller.
 * @param kicker - A small line above the title, such as the disease's name.
 * @param description - A line or two under the title.
 */
export async function renderOgImage({
  title,
  kicker,
  description,
}: {
  title: string;
  kicker?: string;
  description?: string;
}): Promise<ImageResponse> {
  const { regular, medium } = await loadFonts();
  const titleSize = title.length > 60 ? 56 : title.length > 36 ? 68 : 84;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: COLOURS.paper,
          padding: "64px 72px",
          fontFamily: "IBM Plex Sans",
          color: COLOURS.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- this is not a page: it is drawn into a PNG */}
          <img src={MARK} width={64} height={64} alt="" />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 500, color: COLOURS.brand }}>
            disease.observer
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {kicker ? (
            <div style={{ display: "flex", fontSize: 34, color: COLOURS.muted }}>{kicker}</div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          {description ? (
            <div style={{ display: "flex", fontSize: 32, lineHeight: 1.3, color: COLOURS.muted }}>
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", height: 6, width: 120, background: COLOURS.brand, borderRadius: 3 }} />
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "IBM Plex Sans", data: regular, style: "normal", weight: 400 },
        { name: "IBM Plex Sans", data: medium, style: "normal", weight: 500 },
      ],
    },
  );
}
