import { NextResponse, type NextRequest } from "next/server";
import { getDisease } from "@/lib/datasets/registry";

/**
 * Gives an unknown disease a real 404 status. With Cache Components the page
 * shell is sent before the page runs, so `notFound()` in the page would
 * leave the status at 200 (with a `noindex` tag). Checking the slug here,
 * before any rendering, lets the response be a 404. The page still calls
 * `notFound()` as well.
 */
export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/")[2] ?? "";
  if (getDisease(decodeURIComponent(slug))) return NextResponse.next();
  // No route matches this path, so Next.js shows the not-found page with a 404 status.
  return NextResponse.rewrite(new URL("/not-found", request.url));
}

export const config = {
  matcher: "/diseases/:slug",
};
