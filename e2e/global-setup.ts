/**
 * Requests each page once before the tests start. The development server
 * compiles a page the first time it is asked for, which can take long enough
 * to abort the first navigation of several tests that start together. It is
 * harmless against a production server.
 */
export default async function globalSetup() {
  for (const path of ["/", "/map"]) {
    try {
      await fetch(`http://localhost:3000${path}`, { signal: AbortSignal.timeout(120_000) });
    } catch (error) {
      console.warn(`Could not warm up ${path}:`, error);
    }
  }
}
