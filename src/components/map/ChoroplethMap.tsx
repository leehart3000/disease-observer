"use client";

// MapLibre's stylesheet is imported here, and nowhere else, so it is only
// sent with the map page.
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  StyleSpecification,
} from "maplibre-gl";
import { LAYERS } from "@/lib/map/layers";
import type { Scale } from "@/lib/map/scale";
import type { LayerKey, MapDataset } from "@/lib/map/types";
import { useTheme, type Theme } from "../useTheme";

/** An area that the visitor is pointing at or has tapped. */
export type SelectedArea = { code: string; name: string };

type Props = {
  layer: LayerKey;
  dataset: MapDataset | null;
  scale: Scale | null;
  /** Called when the pointed-at area changes. `null` means nothing is selected. */
  onSelect: (area: SelectedArea | null) => void;
  /** Called with the number of areas in a layer's boundary file once it has loaded. */
  onAreaCount: (layer: LayerKey, count: number) => void;
};

/** The OpenFreeMap base maps: positron for the light theme and dark for the dark theme. */
const BASE_STYLES: Record<Theme, { name: string; url: string }> = {
  light: { name: "positron", url: "https://tiles.openfreemap.org/styles/positron" },
  dark: { name: "dark", url: "https://tiles.openfreemap.org/styles/dark" },
};

/** Colours for the layers that we draw, which depend on the theme. */
const PAINT: Record<Theme, { noData: string; outline: string; hover: string; background: string }> = {
  light: { noData: "#c9d0d8", outline: "#fbfcfd", hover: "#24303d", background: "#f3f5f8" },
  dark: { noData: "#3a4856", outline: "#1e2933", hover: "#d6dde5", background: "#172029" },
};

/** England, with some room around it. */
const ENGLAND_BOUNDS: [[number, number], [number, number]] = [
  [-6.2, 49.8],
  [2.1, 55.9],
];
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-10, 48],
  [5, 59],
];

const SOURCE_ID = "areas";
const FILL_ID = "areas-fill";
const LINE_ID = "areas-line";
const HOVER_ID = "areas-hover";

/** Minimal GeoJSON types for our own files. */
type AreaFeature<Properties> = {
  type: "Feature";
  properties: Properties;
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
};
type AreaCollection<Properties> = {
  type: "FeatureCollection";
  features: AreaFeature<Properties>[];
};

/** What MapLibre accepts as GeoJSON data. */
type MapLibreData = Parameters<GeoJSONSource["setData"]>[0];

const EMPTY: AreaCollection<never> = { type: "FeatureCollection", features: [] };

/** A plain background, used if OpenFreeMap cannot be reached, so the areas still show. */
function plainStyle(theme: Theme): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      { id: "background", type: "background", paint: { "background-color": PAINT[theme].background } },
    ],
  };
}

type BoundaryCollection = AreaCollection<{ code: string; name: string }>;
type JoinedCollection = AreaCollection<{
  code: string;
  name: string;
  value?: number;
  provisional?: boolean;
  colour?: string;
}>;

const boundaryRequests = new Map<string, Promise<BoundaryCollection>>();

/** Fetches a boundary file once. A failed request is forgotten, so a later call retries. */
function loadBoundaries(url: string): Promise<BoundaryCollection> {
  let request = boundaryRequests.get(url);
  if (!request) {
    request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
      return response.json() as Promise<BoundaryCollection>;
    });
    request.catch(() => boundaryRequests.delete(url));
    boundaryRequests.set(url, request);
  }
  return request;
}

/** Copies the values and colours onto each area. Areas with no value get no `colour`. */
function joinValues(
  boundaries: BoundaryCollection,
  dataset: MapDataset | null,
  scale: Scale | null,
): JoinedCollection {
  const byCode = new Map(dataset?.values.map((area) => [area.code, area]));
  return {
    type: "FeatureCollection",
    features: boundaries.features.map((feature) => {
      const { code, name } = feature.properties;
      const area = byCode.get(code);
      return {
        ...feature,
        properties:
          area && scale
            ? {
                code,
                name,
                value: area.value,
                provisional: area.provisional,
                colour: scale.colourFor(area.value),
              }
            : { code, name },
      };
    }),
  };
}

/** What the map component keeps between renders without re-rendering. */
type MapState = {
  theme: Theme;
  /** The base style name that was last asked for. */
  styleName: string;
  /** True once we have switched to the plain style because OpenFreeMap failed. */
  usedPlainStyle: boolean;
  /** True once any style has loaded. */
  styleLoaded: boolean;
  hovered: string | null;
  collection: JoinedCollection | null;
};

/** Adds our source and layers to the current style, if they are not there. */
function addAreaLayers(map: MapLibreMap, state: MapState) {
  const paint = PAINT[state.theme];
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: (state.collection ?? EMPTY) as unknown as MapLibreData,
    });
  }
  // Put the areas on top of the base map's roads, rail and buildings (which
  // would clutter them) but under its labels. The layer names are the
  // OpenMapTiles ones that both OpenFreeMap styles use. For any other
  // style, the areas go under the first label layer.
  const styleLayers = map.getStyle().layers;
  let lastGround = -1;
  styleLayers.forEach((layer, index) => {
    if (layer.type !== "symbol" && /^(tunnel|road|highway|railway|bridge|aeroway|building)/.test(layer.id)) {
      lastGround = index;
    }
  });
  const beforeId = styleLayers.slice(lastGround + 1).find((layer) => layer.type === "symbol")?.id;
  const fillColour: ExpressionSpecification = ["coalesce", ["get", "colour"], paint.noData];
  const fillOpacity: ExpressionSpecification = ["case", ["has", "colour"], 0.85, 0.6];
  if (!map.getLayer(FILL_ID)) {
    map.addLayer(
      {
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": fillColour, "fill-opacity": fillOpacity },
      },
      beforeId,
    );
  }
  if (!map.getLayer(LINE_ID)) {
    map.addLayer(
      {
        id: LINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": paint.outline, "line-width": 0.7 },
      },
      beforeId,
    );
  }
  if (!map.getLayer(HOVER_ID)) {
    map.addLayer(
      {
        id: HOVER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "code"], state.hovered ?? ""],
        paint: { "line-color": paint.hover, "line-width": 2.5 },
      },
      beforeId,
    );
  }
}

/** Asks the map for a new base style. Our layers are added again when it has loaded. */
function applyBaseStyle(map: MapLibreMap, state: MapState, theme: Theme) {
  state.theme = theme;
  state.styleName = BASE_STYLES[theme].name;
  state.usedPlainStyle = false;
  // A full rebuild (not a diff) means the style.load event fires every time.
  map.setStyle(BASE_STYLES[theme].url, { diff: false });
}

/**
 * The choropleth map: OpenFreeMap underneath, our areas on top. It follows
 * the site theme by switching the base style without reloading the page.
 *
 * MapLibre is imported inside an effect, so it is only ever loaded in the
 * browser, and only for the page that shows this component. If the map
 * cannot start (for example, there is no WebGL), this throws while
 * rendering, so the nearest error boundary can show a fallback.
 */
export function ChoroplethMap({ layer, dataset, scale, onSelect, onAreaCount }: Props) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [baseStyle, setBaseStyle] = useState<string | null>(null);
  const [dataLayer, setDataLayer] = useState<LayerKey | null>(null);

  const stateRef = useRef<MapState>({
    theme,
    styleName: BASE_STYLES[theme].name,
    usedPlainStyle: false,
    styleLoaded: false,
    hovered: null,
    collection: null,
  });
  const themeRef = useRef(theme);
  const onSelectRef = useRef(onSelect);
  const onAreaCountRef = useRef(onAreaCount);
  useEffect(() => {
    themeRef.current = theme;
    onSelectRef.current = onSelect;
    onAreaCountRef.current = onAreaCount;
  });

  if (failure) throw failure;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let created: MapLibreMap | undefined;

    function select(area: SelectedArea | null) {
      const state = stateRef.current;
      if ((area?.code ?? null) === state.hovered) return;
      state.hovered = area?.code ?? null;
      if (created?.getLayer(HOVER_ID)) {
        created.setFilter(HOVER_ID, ["==", ["get", "code"], area?.code ?? ""]);
      }
      onSelectRef.current(area);
    }

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        // The bundler moves MapLibre's script, so it can't find its worker
        // on its own. A copy is served from /maplibre/ (see
        // scripts/maplibre-worker.mts).
        maplibre.setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
        const state = stateRef.current;
        state.theme = themeRef.current;
        state.styleName = BASE_STYLES[state.theme].name;

        const instance = new maplibre.Map({
          container: containerRef.current,
          style: BASE_STYLES[state.theme].url,
          bounds: ENGLAND_BOUNDS,
          maxBounds: MAX_BOUNDS,
          // Keep the credit visible, not collapsed behind a button.
          attributionControl: { compact: false },
          // One finger scrolls the page and two move the map.
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        created = instance;
        instance.touchZoomRotate.disableRotation();
        instance.touchPitch.disable();
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        instance.on("style.load", () => {
          state.styleLoaded = true;
          addAreaLayers(instance, state);
          // Report the style as ready once the areas have been drawn on it.
          const name = state.usedPlainStyle ? "plain" : state.styleName;
          instance.once("idle", () => setBaseStyle(name));
        });
        instance.on("error", () => {
          // If the base style cannot be loaded at all, draw our areas on a
          // plain background instead.
          if (!state.styleLoaded && !state.usedPlainStyle) {
            state.usedPlainStyle = true;
            instance.setStyle(plainStyle(state.theme), { diff: false });
          }
        });

        // Pointing selects an area, but only where there is a pointer that can
        // hover. On a phone, the mouse events that follow a tap would clear
        // the selection straight away.
        if (window.matchMedia("(hover: hover)").matches) {
          instance.on("mousemove", FILL_ID, (event: MapLayerMouseEvent) => {
            instance.getCanvas().style.cursor = "pointer";
            const properties = event.features?.[0]?.properties;
            if (properties) select({ code: String(properties.code), name: String(properties.name) });
          });
          instance.on("mouseleave", FILL_ID, () => {
            instance.getCanvas().style.cursor = "";
            select(null);
          });
        }
        // A tap (or click) selects the area under it, or clears the selection.
        instance.on("click", (event) => {
          const features = instance.getLayer(FILL_ID)
            ? instance.queryRenderedFeatures(event.point, { layers: [FILL_ID] })
            : [];
          const properties = features[0]?.properties;
          select(properties ? { code: String(properties.code), name: String(properties.name) } : null);
        });

        setMap(instance);
      } catch (error) {
        if (!cancelled) setFailure(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => {
      cancelled = true;
      created?.remove();
    };
  }, []);

  // Switch the base style when the theme changes.
  useEffect(() => {
    if (!map) return;
    const state = stateRef.current;
    if (state.styleName === BASE_STYLES[theme].name && !state.usedPlainStyle) return;
    applyBaseStyle(map, state, theme);
  }, [map, theme]);

  // Draw the current layer's values.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    loadBoundaries(LAYERS[layer].boundaryUrl)
      .then(async (boundaries) => {
        if (cancelled) return;
        const state = stateRef.current;
        state.collection = joinValues(boundaries, dataset, scale);
        state.hovered = null;
        if (map.getLayer(HOVER_ID)) map.setFilter(HOVER_ID, ["==", ["get", "code"], ""]);
        onSelectRef.current(null);
        onAreaCountRef.current(layer, boundaries.features.length);
        // If a style change is in progress, the new style picks this data up.
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        await source?.setData(state.collection as unknown as MapLibreData);
        if (cancelled) return;
        // Report the layer as ready once the map has drawn it.
        if (map.loaded()) setDataLayer(layer);
        else map.once("idle", () => !cancelled && setDataLayer(layer));
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error : new Error(String(error)));
      });
    return () => {
      cancelled = true;
    };
  }, [map, layer, dataset, scale]);

  const ready = baseStyle !== null && dataLayer === layer;

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      data-testid="map-canvas"
      data-base-style={baseStyle ?? undefined}
      data-map-ready={ready ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          stateRef.current.hovered = null;
          if (map?.getLayer(HOVER_ID)) map.setFilter(HOVER_ID, ["==", ["get", "code"], ""]);
          onSelect(null);
        }
      }}
    />
  );
}
