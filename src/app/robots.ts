import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** `/robots.txt`: everything may be crawled except the API, and the sitemap is named. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
