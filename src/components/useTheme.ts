"use client";

import { useSyncExternalStore } from "react";

/** The two themes the site has. */
export type Theme = "light" | "dark";

const darkQuery = "(prefers-color-scheme: dark)";

/** Re-renders when the theme attribute or the system setting changes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const media = window.matchMedia(darkQuery);
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/** The theme in effect: the chosen one, else the system setting. */
function getTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia(darkQuery).matches ? "dark" : "light";
}

/**
 * The theme in effect, kept up to date when the visitor switches it or the
 * system setting changes. The server cannot know the theme, so it renders
 * the light theme.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}
