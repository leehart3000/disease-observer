import type { MetadataRoute } from "next";
import { sitePaths } from "@/lib/datasets/routes";
import { absoluteUrl } from "@/lib/seo";

/**
 * The sitemap, at `/sitemap.xml`. Every page comes from the registry (see
 * `sitePaths`), so a new disease or dataset is listed without more work.
 * There is no `lastModified`: nothing at build time says when a page's
 * figures last changed, and the build has no database.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitePaths().map((path) => ({ url: absoluteUrl(path) }));
}
