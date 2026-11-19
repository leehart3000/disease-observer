import { SiteHeader } from "@/components/SiteHeader";

/** Placeholder home page. */
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-20">
        <h1 className="max-w-2xl text-balance text-3xl font-medium tracking-tight sm:text-4xl">
          Maps and charts for infectious disease surveillance
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          This site is being built. Please check back soon.
        </p>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted sm:px-6">
          © 2026 Disease Observer
        </div>
      </footer>
    </>
  );
}
