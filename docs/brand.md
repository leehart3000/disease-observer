# Brand

This guide describes the Disease Observer logo, colours and type, and how to
use them in the site.

## Name and wordmark

- The wordmark is `disease.observer`, all lower case, in IBM Plex Sans
  Medium (500).
- Both words are in the brand blue. The dot between the words and the dot
  on the `i` are in the accent red.
- In running text, write the name as "Disease Observer".
- On the site, the wordmark is live text, not an image. The red `i` dot is
  made by using a dotless `ı` (U+0131) with a small red circle placed above
  it. Give the whole wordmark an accessible name of "disease.observer" and
  hide the decorative parts from screen readers.

## Mark

The mark is a rod of Asclepius drawn as a chart: an upright rod with five
data points that swing from side to side and grow then shrink, joined by a
faint curve that suggests the serpent. It sits inside a narrow oval.

| File | Use |
| --- | --- |
| `public/brand/mark-light.svg` | On light backgrounds |
| `public/brand/mark-dark.svg` | On dark backgrounds |
| `src/app/icon.svg` | Browser favicon (switches with the system colour scheme) |
| `src/app/favicon.ico` | Fallback favicon (16, 32 and 48 px) |
| `src/app/apple-icon.png` | Home screen icon on Apple devices (180 px) |

Rules:

- Minimum size: 16 px tall.
- Keep clear space around the mark of at least a quarter of its height.
- In the header, place the mark to the left of the wordmark. The mark's
  height is about 1.5 times the wordmark's font size.
- Do not rotate, stretch or recolour the mark, and do not remove the faint
  curve.
- Do not combine the rod with a globe, a laurel wreath or a six-pointed
  star. Those combinations belong to protected emblems.

## Colour

Interface colours. Text colours meet WCAG AA contrast on the paper colour.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#F3F5F8` | `#172029` | Page background |
| `surface` | `#FBFCFD` | `#1E2933` | Cards, header |
| `ink` | `#24303D` | `#D6DDE5` | Body text |
| `muted` | `#5A6675` | `#95A2B1` | Secondary text |
| `line` | `#D7DDE4` | `#2E3B48` | Borders, dividers |
| `brand` | `#2B5C9E` | `#84AEE6` | Wordmark, links, primary actions |
| `accent` | `#BC4034` | `#F08A7E` | Wordmark dots, small highlights only |

Mark colours:

| Part | Light | Dark |
| --- | --- | --- |
| Oval | `#2B5C9E` | `#84AEE6` |
| Rod, dots, curve | `#F7F9FB` | `#172029` |
| Top dot | `#FFB4A8` | `#9E2E24` |

The top dot is a paler red in light mode because the accent red has too
little contrast against the blue oval.

Data colours are separate from interface colours:

- Sequential scales (heatmaps, choropleths): viridis.
- One colour per disease: Okabe–Ito (`#E69F00`, `#56B4E9`, `#009E73`,
  `#F0E442`, `#0072B2`, `#D55E00`, `#CC79A7`).

Both stay distinguishable for people with colour vision deficiency.

## Type

- IBM Plex Sans for all interface text: 400 for body, 500 for headings and
  the wordmark, 600 for strong emphasis.
- IBM Plex Mono (400, 500) for numbers in tables, dates, codes and
  coordinates.
- Fonts are installed from npm and served with the site, not loaded from
  a third-party font service.

## Themes

The site supports light and dark themes and follows the visitor's system
setting by default. Every page must work at 375 px wide (iPhone SE).
