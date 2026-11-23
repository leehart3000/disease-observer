import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { themeInitScript } from "@/components/theme";
import { SITE_URL } from "@/lib/seo";
import { plexMono, plexSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // The base for relative URLs in metadata, such as canonical links.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Disease Observer",
    template: "%s | Disease Observer",
  },
  description: "Maps and charts for infectious disease surveillance.",
  // The site-wide parts of the social cards. Pages with their own text
  // (`socialMetadata`) repeat them, and the picture comes from the
  // `opengraph-image` and `twitter-image` files.
  openGraph: { type: "website", siteName: "Disease Observer", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F8" },
    { media: "(prefers-color-scheme: dark)", color: "#172029" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The inline script may set data-theme before React hydrates.
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
