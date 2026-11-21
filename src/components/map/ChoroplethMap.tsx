"use client";

// MapLibre's stylesheet and our own overrides for it are imported here, and
// nowhere else, so they are only sent with the map page.
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  IControl,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  StyleSpecification,
  TransformStyleFunction,
} from "maplibre-gl";
import type { Scale } from "@/lib/map/scale";
import type { MapDataset } from "@/lib/map/types";
import { useTheme, type Theme } from "../useTheme";

/** An area that the visitor is pointing at, has tapped or has chosen in the table. */
export type SelectedArea = { code: string; name: string };

/**
 * Where an area is on the screen, in pixels from the top left of the map,
 * and how big the map is.
 */
export type AreaRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  mapWidth: number;
  mapHeight: number;
};

type Props = {
  /** The registry id of the dataset being drawn. */
  datasetId: string;
  /** The static boundary file for the dataset's areas. */
  boundaryUrl: string;
  dataset: MapDataset | null;
  scale: Scale | null;
  /** The area to outline, if any. */
  highlightCode: string | null;
  /** True while the map, key and readout are expanded to fill the screen. */
  expanded: boolean;
  /** Called when the full screen button is pressed. */
  onToggleExpanded: () => void;
  /** Called with the full screen button once it exists, so focus can return to it. */
  onFullscreenButton: (button: HTMLButtonElement | null) => void;
  /**
   * Called with where the outlined area is on the screen (or `null` if
   * there is none), and again whenever the map moves or is resized.
   */
  onHighlightRect: (rect: AreaRect | null) => void;
  /** Called when the pointer moves over an area, or off all of them (`null`). */
  onHover: (area: SelectedArea | null) => void;
  /** Called when an area is clicked or tapped, or empty map is (`null`). */
  onSelect: (area: SelectedArea | null) => void;
  /** Called with the number of areas in a dataset's boundary file once it has loaded. */
  onAreaCount: (datasetId: string, count: number) => void;
};

/** The OpenFreeMap base maps: positron for the light theme and dark for the dark theme. */
const BASE_STYLES: Record<Theme, { name: string; url: string }> = {
  light: { name: "positron", url: "https://tiles.openfreemap.org/styles/positron" },
  dark: { name: "dark", url: "https://tiles.openfreemap.org/styles/dark" },
};

/** Colours for the layers that we draw, which depend on the theme. */
const PAINT: Record<Theme, { noData: string; outline: string; background: string }> = {
  light: { noData: "#c9d0d8", outline: "#fbfcfd", background: "#f3f5f8" },
  dark: { noData: "#3a4856", outline: "#1e2933", background: "#172029" },
};

/**
 * Label colours that stand out over our fills. They replace the base
 * style's own colours (OpenFreeMap's files are not edited) on its place
 * labels.
 */
const LABEL_PAINT: Record<Theme, Record<string, string | number>> = {
  light: { "text-color": "#14202b", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
  dark: { "text-color": "#f5f8fb", "text-halo-color": "#0a1016", "text-halo-width": 1.8 },
};

/** The two tones of the highlight outline: a wide white line under a narrower dark one. */
const HIGHLIGHT = { under: "#ffffff", over: "#0a1016" };

/** The place label layers in OpenFreeMap's styles (`place_*` in dark, `label_*` in positron). */
const PLACE_LABEL = /^(place|label)_/;

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
const HIGHLIGHT_UNDER_ID = "areas-highlight-under";
const HIGHLIGHT_OVER_ID = "areas-highlight-over";

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

/** Makes the base style's place labels easier to read over the areas. */
function emphasiseLabels(theme: Theme): TransformStyleFunction {
  return (_previous, next) => ({
    ...next,
    layers: next.layers.map((layer) =>
      layer.type === "symbol" && PLACE_LABEL.test(layer.id)
        ? { ...layer, paint: { ...layer.paint, ...LABEL_PAINT[theme] } }
        : layer,
    ),
  });
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
  /** The code of the outlined area. */
  highlight: string | null;
  collection: JoinedCollection | null;
};

/** The filter that picks out the outlined area (or nothing). */
function highlightFilter(code: string | null): ExpressionSpecification {
  return ["==", ["get", "code"], code ?? ""];
}

/** The box around an area, on the screen. `null` if there is no such area on the map. */
function areaRect(map: MapLibreMap, collection: JoinedCollection | null, code: string | null): AreaRect | null {
  const feature = code ? collection?.features.find((f) => f.properties.code === code) : undefined;
  if (!feature) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const polygon of feature.geometry.coordinates) {
    for (const [lng, lat] of polygon[0]) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  const topLeft = map.project([west, north]);
  const bottomRight = map.project([east, south]);
  const { clientWidth, clientHeight } = map.getContainer();
  return {
    left: Math.round(topLeft.x),
    top: Math.round(topLeft.y),
    right: Math.round(bottomRight.x),
    bottom: Math.round(bottomRight.y),
    mapWidth: clientWidth,
    mapHeight: clientHeight,
  };
}

/** Outlines one area, or none. */
function setHighlight(map: MapLibreMap, code: string | null) {
  for (const id of [HIGHLIGHT_UNDER_ID, HIGHLIGHT_OVER_ID]) {
    if (map.getLayer(id)) map.setFilter(id, highlightFilter(code));
  }
}

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
  // The highlight is two lines: a wide white one with a narrower dark one
  // on top, so it shows against every fill colour in both themes.
  if (!map.getLayer(HIGHLIGHT_UNDER_ID)) {
    map.addLayer(
      {
        id: HIGHLIGHT_UNDER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: highlightFilter(state.highlight),
        layout: { "line-join": "round" },
        paint: { "line-color": HIGHLIGHT.under, "line-width": 5 },
      },
      beforeId,
    );
  }
  if (!map.getLayer(HIGHLIGHT_OVER_ID)) {
    map.addLayer(
      {
        id: HIGHLIGHT_OVER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: highlightFilter(state.highlight),
        layout: { "line-join": "round" },
        paint: { "line-color": HIGHLIGHT.over, "line-width": 2 },
      },
      beforeId,
    );
  }
}

/** A full screen button in MapLibre's control style. */
type FullscreenControl = {
  control: IControl;
  button: HTMLButtonElement;
  /** Updates the label and icon. */
  setExpanded: (expanded: boolean) => void;
};

/**
 * Builds the full screen button. MapLibre's own full screen control only
 * expands the map, and does nothing useful where the Fullscreen API is
 * missing (iPhone Safari). This one only reports the click. The page
 * decides how to expand, so the key and readout go with the map.
 */
function createFullscreenControl(onClick: () => void): FullscreenControl {
  const container = document.createElement("div");
  container.className = "maplibregl-ctrl maplibregl-ctrl-group";
  const button = document.createElement("button");
  button.type = "button";
  const icon = document.createElement("span");
  icon.className = "maplibregl-ctrl-icon";
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
  container.append(button);
  button.addEventListener("click", onClick);

  const setExpanded = (expanded: boolean) => {
    const label = expanded ? "Exit fullscreen" : "Enter fullscreen";
    // MapLibre's stylesheet draws the icon from these class names.
    button.className = expanded ? "maplibregl-ctrl-shrink" : "maplibregl-ctrl-fullscreen";
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  setExpanded(false);

  return {
    control: { onAdd: () => container, onRemove: () => container.remove() },
    button,
    setExpanded,
  };
}

/** Asks the map for a new base style. Our layers are added again when it has loaded. */
function applyBaseStyle(map: MapLibreMap, state: MapState, theme: Theme) {
  state.theme = theme;
  state.styleName = BASE_STYLES[theme].name;
  state.usedPlainStyle = false;
  // A full rebuild (not a diff) means the style.load event fires every time.
  map.setStyle(BASE_STYLES[theme].url, { diff: false, transformStyle: emphasiseLabels(theme) });
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
export function ChoroplethMap({
  datasetId,
  boundaryUrl,
  dataset,
  scale,
  highlightCode,
  expanded,
  onToggleExpanded,
  onFullscreenButton,
  onHighlightRect,
  onHover,
  onSelect,
  onAreaCount,
}: Props) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const [baseStyle, setBaseStyle] = useState<string | null>(null);
  /** The dataset that the map has finished drawing. */
  const [drawnDataset, setDrawnDataset] = useState<string | null>(null);

  const stateRef = useRef<MapState>({
    theme,
    styleName: BASE_STYLES[theme].name,
    usedPlainStyle: false,
    styleLoaded: false,
    highlight: highlightCode,
    collection: null,
  });
  const themeRef = useRef(theme);
  const fullscreenRef = useRef<FullscreenControl | null>(null);
  const callbacksRef = useRef({
    onHover,
    onSelect,
    onAreaCount,
    onToggleExpanded,
    onFullscreenButton,
    onHighlightRect,
  });
  useEffect(() => {
    themeRef.current = theme;
    callbacksRef.current = {
      onHover,
      onSelect,
      onAreaCount,
      onToggleExpanded,
      onFullscreenButton,
      onHighlightRect,
    };
  });

  if (failure) throw failure;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let created: MapLibreMap | undefined;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        // The bundler moves MapLibre's script, so it can't find its worker
        // on its own. A copy is served from /maplibre/ (see
        // scripts/maplibre-worker.mts).
        maplibre.setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
        const state = stateRef.current;

        // The style is set below, so that it goes through transformStyle.
        const instance = new maplibre.Map({
          container: containerRef.current,
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
        // The button is labelled "Enter fullscreen" or "Exit fullscreen".
        const fullscreen = createFullscreenControl(() => callbacksRef.current.onToggleExpanded());
        fullscreenRef.current = fullscreen;
        instance.addControl(fullscreen.control, "top-right");
        callbacksRef.current.onFullscreenButton(fullscreen.button);

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

        // Pointing previews an area, but only where there is a pointer that
        // can hover. On a phone, the mouse events that follow a tap would
        // otherwise interfere with it.
        if (window.matchMedia("(hover: hover)").matches) {
          instance.on("mousemove", FILL_ID, (event: MapLayerMouseEvent) => {
            instance.getCanvas().style.cursor = "pointer";
            const properties = event.features?.[0]?.properties;
            if (properties) {
              callbacksRef.current.onHover({
                code: String(properties.code),
                name: String(properties.name),
              });
            }
          });
          instance.on("mouseleave", FILL_ID, () => {
            instance.getCanvas().style.cursor = "";
            callbacksRef.current.onHover(null);
          });
        }
        // A click or tap chooses the area under it, or empty map.
        instance.on("click", (event) => {
          const features = instance.getLayer(FILL_ID)
            ? instance.queryRenderedFeatures(event.point, { layers: [FILL_ID] })
            : [];
          const properties = features[0]?.properties;
          callbacksRef.current.onSelect(
            properties ? { code: String(properties.code), name: String(properties.name) } : null,
          );
        });

        // Keep the parent told where the outlined area is, as the map moves
        // or changes size.
        const reportRect = () =>
          callbacksRef.current.onHighlightRect(areaRect(instance, state.collection, state.highlight));
        instance.on("moveend", reportRect);
        instance.on("resize", reportRect);

        applyBaseStyle(instance, state, themeRef.current);
        setMap(instance);
      } catch (error) {
        if (!cancelled) setFailure(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return () => {
      cancelled = true;
      created?.remove();
      fullscreenRef.current = null;
      callbacksRef.current.onFullscreenButton(null);
    };
  }, []);

  // When the map is expanded or collapsed: update the button, let one finger
  // move the map (the page is not scrolling then), and resize the map once
  // the layout has changed.
  useEffect(() => {
    if (!map) return;
    fullscreenRef.current?.setExpanded(expanded);
    if (expanded) map.cooperativeGestures.disable();
    else map.cooperativeGestures.enable();
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => map.resize());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [map, expanded]);

  // Switch the base style when the theme changes.
  useEffect(() => {
    if (!map) return;
    const state = stateRef.current;
    if (state.styleName === BASE_STYLES[theme].name && !state.usedPlainStyle) return;
    applyBaseStyle(map, state, theme);
  }, [map, theme]);

  // Outline the highlighted area.
  useEffect(() => {
    stateRef.current.highlight = highlightCode;
    if (!map) return;
    setHighlight(map, highlightCode);
    callbacksRef.current.onHighlightRect(areaRect(map, stateRef.current.collection, highlightCode));
  }, [map, highlightCode]);

  // Draw the current dataset's values.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    loadBoundaries(boundaryUrl)
      .then(async (boundaries) => {
        if (cancelled) return;
        const state = stateRef.current;
        state.collection = joinValues(boundaries, dataset, scale);
        callbacksRef.current.onAreaCount(datasetId, boundaries.features.length);
        // If a style change is in progress, the new style picks this data up.
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        await source?.setData(state.collection as unknown as MapLibreData);
        if (cancelled) return;
        // Report the dataset as ready once the map has drawn it.
        if (map.loaded()) setDrawnDataset(datasetId);
        else map.once("idle", () => !cancelled && setDrawnDataset(datasetId));
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error : new Error(String(error)));
      });
    return () => {
      cancelled = true;
    };
  }, [map, datasetId, boundaryUrl, dataset, scale]);

  const ready = baseStyle !== null && drawnDataset === datasetId;

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      data-testid="map-canvas"
      data-dataset={datasetId}
      data-base-style={baseStyle ?? undefined}
      data-map-ready={ready ? "true" : "false"}
      data-highlight={highlightCode ?? undefined}
    />
  );
}
