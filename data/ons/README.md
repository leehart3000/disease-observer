# ONS boundaries

Area boundaries for England, used for the map and for the shapes of the
areas that UKHSA reports on.

## Files

- `lad-dec-2022-england.geojson`: 309 local authority districts in England
  (codes starting `E06`, `E07`, `E08` and `E09`), December 2022.
- `rgn-dec-2022-england.geojson`: the 9 regions of England, December 2022
  (codes starting `E12`).

Each feature has a `code`, a `name` and a geometry, in WGS 84
(EPSG:4326, longitude and latitude). Both are ultra-generalised (BUC)
boundaries, which are small and suit web maps, but are not accurate enough
for measuring or for detailed street-level work.

## Where they come from

They are taken from two Office for National Statistics (ONS) datasets,
published under the Open Government Licence v3.0:

- Local Authority Districts (December 2022) Boundaries UK BUC:
  https://open-geography-portalx-ons.hub.arcgis.com/datasets/ons::local-authority-districts-december-2022-boundaries-uk-buc-2
- Regions (December 2022) Boundaries EN BUC:
  https://open-geography-portalx-ons.hub.arcgis.com/datasets/ons::regions-december-2022-boundaries-en-buc

## How they were made

Download the two GeoJSON files from the hub pages above into
`data/ons/raw/` (ignored by Git), named `LAD_DEC_2022_UK_BUC.geojson` and
`RGN_DEC_2022_EN_BUC.geojson`. Then run:

```bash
pnpm boundaries:prepare
```

The script (`scripts/boundaries/prepare.mts`) keeps only the English local
authorities, drops every property except the code and the name, and writes
compact JSON. `pnpm db:boundaries` loads the committed files into the
database.

## Attribution

Source: Office for National Statistics licensed under the Open Government Licence v.3.0
Contains OS data © Crown copyright and database right 2022
