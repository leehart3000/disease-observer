"use client";

import { ErrorPanel } from "@/components/ErrorPanel";
import { themeInitScript } from "@/components/theme";
import { plexMono, plexSans } from "./fonts";
import "./globals.css";

/**
 * The last resort: shown when the root layout itself fails, so it replaces the
 * layout and has its own `html` and `body`. There is no header or footer here,
 * because they are what may have failed. No details of the error are shown.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <title>Something went wrong | Disease Observer</title>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
          <p className="mb-6 text-xl font-medium text-brand">disease.observer</p>
          <ErrorPanel retry={retry} />
        </main>
      </body>
    </html>
  );
}
