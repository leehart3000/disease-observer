/**
 * Rebuilds the raster icons from the light mark:
 *
 * - src/app/favicon.ico (16, 32 and 48 px, transparent background)
 * - src/app/apple-icon.png (180 px, on the light paper colour)
 *
 * Run with `pnpm icons`. It renders with Chromium, so set CHROMIUM_PATH to
 * use a system browser, or run `pnpm exec playwright install chromium`.
 */
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const markUrl = new URL("public/brand/mark-light.svg", root);
const faviconUrl = new URL("src/app/favicon.ico", root);
const appleIconUrl = new URL("src/app/apple-icon.png", root);

const FAVICON_SIZES = [16, 32, 48];
const APPLE_ICON_SIZE = 180;
/** The light "paper" colour from docs/brand.md. */
const PAPER = "#F3F5F8";
/** Share of the Apple icon left empty on each side. */
const APPLE_ICON_PADDING = 0.1;

const svg = await readFile(markUrl, "utf8");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

/** Renders the mark as a PNG, `markSize` px tall, centred on a square canvas. */
async function render(
  canvasSize: number,
  markSize: number,
  background: string | null,
): Promise<Buffer> {
  const page = await browser.newPage({
    viewport: { width: canvasSize, height: canvasSize },
    deviceScaleFactor: 1,
  });
  const markSvg = svg.replace(
    "<svg ",
    `<svg width="${markSize}" height="${markSize}" `,
  );
  await page.setContent(
    `<style>html,body{margin:0;height:100%;background:${background ?? "transparent"};display:grid;place-items:center}svg{display:block}</style>${markSvg}`,
  );
  const png = await page.screenshot({
    omitBackground: background === null,
    type: "png",
  });
  await page.close();
  return png;
}

/** Packs PNG images into an ICO file. */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const headerSize = 6 + 16 * images.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry); // width
    header.writeUInt8(size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

try {
  const favicons = [];
  for (const size of FAVICON_SIZES) {
    favicons.push({ size, png: await render(size, size, null) });
  }
  await writeFile(faviconUrl, buildIco(favicons));

  const markSize = Math.round(APPLE_ICON_SIZE * (1 - 2 * APPLE_ICON_PADDING));
  await writeFile(
    appleIconUrl,
    await render(APPLE_ICON_SIZE, markSize, PAPER),
  );
  console.log("Wrote src/app/favicon.ico and src/app/apple-icon.png");
} finally {
  await browser.close();
}
