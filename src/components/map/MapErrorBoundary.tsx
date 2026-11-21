"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches errors from the map (no WebGL, a failed download and so on) and
 * shows a short message instead. The rest of the page, including the table
 * of values, keeps working.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("The map could not be shown:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          role="status"
          className="flex h-full items-center justify-center bg-surface p-6 text-center text-muted"
        >
          The map can&rsquo;t be shown. The table below has the same values.
        </div>
      );
    }
    return this.props.children;
  }
}
