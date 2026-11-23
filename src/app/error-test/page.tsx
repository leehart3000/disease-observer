import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A page that fails on purpose, so the error page can be tested and looked
 * at. It only fails when `ERROR_PAGE_TEST=1` (the end-to-end tests and the
 * developer's own server set it). On the live site the variable is not set,
 * so this address is a plain 404.
 */
export default function ErrorTestPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <FailOnPurpose />
    </Suspense>
  );
}

async function FailOnPurpose(): Promise<never> {
  // Wait for a real request, so the failure is never part of the build.
  await connection();
  if (process.env.ERROR_PAGE_TEST !== "1") notFound();
  throw new Error("This page fails on purpose, to test the error page.");
}
