"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme";

type Theme = "light" | "dark";

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

const iconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
  className: "size-5",
} as const;

/**
 * A button that switches between the light and dark themes. It follows the
 * system setting until the visitor chooses, then remembers the choice in
 * localStorage. Both icons are rendered and CSS shows the right one, so the
 * icon is correct before the page hydrates.
 */
export function ThemeToggle() {
  // The server cannot know the theme, so it renders the light-theme label.
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";

  function choose() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked. The choice then lasts until the page closes.
    }
  }

  return (
    <button
      type="button"
      onClick={choose}
      aria-label={`Switch to ${next} theme`}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* Moon, shown in light mode. */}
      <svg {...iconProps} className="size-5 dark:hidden">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      {/* Sun, shown in dark mode. */}
      <svg {...iconProps} className="hidden size-5 dark:block">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}
