/**
 * Checks on a request's path that decide, before any page is rendered,
 * whether it can be a page of the site. They are used by `src/proxy.ts`,
 * which turns the answer into a real 404 status (a Cache Components page
 * cannot change its status once its shell is sent).
 *
 * Erasable TypeScript only, with relative imports that end in `.ts`, so
 * tests can import it too.
 */
import { getDisease } from "./datasets/registry.ts";

/** Decodes a path segment, leaving it as it is if it is not valid (such as `%E0%A4`). */
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Whether a `/diseases/<slug>` path is a disease in the registry.
 *
 * @param pathname - The request's path, such as `/diseases/covid-19`.
 */
export function isKnownDiseasePath(pathname: string): boolean {
  const slug = pathname.split("/")[2] ?? "";
  return getDisease(safeDecode(slug)) !== undefined;
}
