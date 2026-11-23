import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The picture shown when a page of the site is shared (Open Graph and Twitter
 * cards): the mark, the site name and the page's title, on the site's colours,
 * in IBM Plex Sans. The images are made at build time (they read no database),
 * so they are plain files when the site is served.
 *
 * The fonts and the mark are read once, here, at the module's start.
 */

/** The size every card image uses (the usual 1.91 to 1). */
export const OG_SIZE = { width: 1200, height: 630 };

const fontFiles = join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans/files");
const [regular, medium, markSvg] = await Promise.all([
  readFile(join(fontFiles, "ibm-plex-sans-latin-400-normal.woff")),
  readFile(join(fontFiles, "ibm-plex-sans-latin-500-normal.woff")),
  readFile(join(process.cwd(), "public/brand/mark-light.svg")),
]);
const MARK = `data:image/svg+xml;base64,${markSvg.toString("base64")}`;

/** The site's colours in the light theme (see `globals.css`). */
const COLOURS = { paper: "#f3f5f8", ink: "#24303d", muted: "#5a6675", brand: "#2b5c9e", line: "#d7dde4" };

/**
 * Makes a card image.
 *
 * @param title - The page's title, large. Long titles are set smaller.
 * @param kicker - A small line above the title, such as the disease's name.
 * @param description - A line or two under the title.
 */
export function renderOgImage({
  title,
  kicker,
  description,
}: {
  title: string;
  kicker?: string;
  description?: string;
}): ImageResponse {
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
