import { NextResponse, type NextRequest } from "next/server";
import { isKnownDiseasePath } from "@/lib/routing";

/**
 * Gives an unknown disease a real 404 status. With Cache Components the page
 * shell is sent before the page runs, so `notFound()` in the page would
 * leave the status at 200 (with a `noindex` tag). Checking the slug here,
 * before any rendering, lets the response be a 404. The page still calls
 * `notFound()` as well.
 *
 * It runs only for `/diseases/<slug>` (see `config.matcher`), never for
 * other pages, assets or images. A known disease passes through with an
 * `x-disease-checked` header, which the tests use to see where it ran.
 */
export function proxy(request: NextRequest) {
  if (isKnownDiseasePath(request.nextUrl.pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-disease-checked", "1");
    return response;
  }
  // No route matches this path, so Next.js shows the not-found page with a 404 status.
  return NextResponse.rewrite(new URL("/not-found", request.url));
}

export const config = {
  matcher: "/diseases/:slug",
};
