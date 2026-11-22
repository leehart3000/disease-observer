import { NextResponse, type NextRequest } from "next/server";
import { decideRoute } from "@/lib/routing";

/**
 * Looks at a request before any page is rendered, for two reasons (see
 * `decideRoute`):
 *
 * - Real 404s. With Cache Components the page shell is sent before the page
 *   runs, so `notFound()` in a page would leave the status at 200 (with a
 *   `noindex` tag). Checking the address here lets the response be a 404.
 *   The pages still call `notFound()` as well.
 * - The old map address `/map?d=…` is a permanent redirect (308) to the
 *   dataset's map page, so shared links keep working.
 *
 * It runs only for the addresses in `config.matcher`, never for other pages,
 * assets or images. A request that carries on is marked with an
 * `x-disease-checked` header, which the tests use to see where it ran.
 */
export function proxy(request: NextRequest) {
  const decision = decideRoute(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url), 308);
  }
  if (decision.action === "not-found") {
    // No route matches this path, so Next.js shows the not-found page with a 404 status.
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }
  const response = NextResponse.next();
  response.headers.set("x-disease-checked", "1");
  return response;
}

export const config = {
  matcher: ["/map", "/diseases/:slug", "/diseases/:slug/:dataset", "/diseases/:slug/:dataset/:view"],
};
