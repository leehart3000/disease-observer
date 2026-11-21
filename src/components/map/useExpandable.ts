"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * How the frame is expanded: with the browser's Fullscreen API (`native`),
 * or by a CSS mode that fills the viewport (`css`).
 */
export type ExpandMode = "native" | "css";

/**
 * Lets one wrapper element (the map with its key and readout) fill the
 * screen.
 *
 * - Where the Fullscreen API works on a `div`, the wrapper goes full screen
 *   with it. iPhone Safari only supports it for video, so there (and if the
 *   request is refused) the wrapper is expanded with CSS instead
 *   (`.map-frame[data-mode="css"]` in map.css): fixed, filling the viewport,
 *   above everything else.
 * - In the CSS mode, the page behind cannot scroll or be reached with the
 *   keyboard (the site header and footer are made `inert`, and the caller
 *   does the same for the rest of the page), and Escape leaves the mode.
 *   The browser handles Escape itself in native full screen.
 * - When the frame stops being expanded, focus goes back to the button.
 *
 * @param frameRef - The wrapper that is expanded.
 * @param buttonRef - The button that toggles it, which gets focus back.
 */
export function useExpandable(
  frameRef: RefObject<HTMLElement | null>,
  buttonRef: RefObject<HTMLElement | null>,
) {
  const [mode, setMode] = useState<ExpandMode | null>(null);
  const wasExpanded = useRef(false);

  // Native full screen can start or stop without us (the Escape key).
  useEffect(() => {
    function onChange() {
      setMode((current) =>
        document.fullscreenElement && document.fullscreenElement === frameRef.current
          ? "native"
          : current === "native"
            ? null
            : current,
      );
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [frameRef]);

  // In the CSS mode: stop the page behind from scrolling or taking focus, and
  // let Escape leave the mode.
  useEffect(() => {
    if (mode !== "css") return;
    // The frame leaves the page's flow while it is expanded, so put the
    // scroll position back afterwards.
    const scrollY = window.scrollY;
    document.documentElement.classList.add("map-expanded");
    const behind = [...document.querySelectorAll("body > header, body > footer")];
    behind.forEach((element) => element.setAttribute("inert", ""));
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMode(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.classList.remove("map-expanded");
      behind.forEach((element) => element.removeAttribute("inert"));
      window.scrollTo(0, scrollY);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mode]);

  // Give focus back to the button when the frame is no longer expanded,
  // however it was left.
  useEffect(() => {
    if (mode === null && wasExpanded.current) buttonRef.current?.focus();
    wasExpanded.current = mode !== null;
  }, [mode, buttonRef]);

  const toggle = useCallback(async () => {
    const frame = frameRef.current;
    if (mode === "native") {
      await document.exitFullscreen?.();
    } else if (mode === "css") {
      setMode(null);
    } else if (frame && document.fullscreenEnabled && typeof frame.requestFullscreen === "function") {
      try {
        // The change event sets the mode.
        await frame.requestFullscreen();
      } catch {
        setMode("css");
      }
    } else {
      setMode("css");
    }
  }, [mode, frameRef]);

  return { mode, expanded: mode !== null, toggle };
}
