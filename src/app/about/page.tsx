import type { Metadata } from "next";
import Link from "next/link";
import { strongLink } from "@/components/link-styles";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Disease Observer is, where its figures come from, and what they can and cannot tell you.",
};

/** What the site is, where its figures come from, and what they cannot tell you. */
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">About</h1>
      <div className="mt-6 grid max-w-2xl gap-8">
        <section aria-labelledby="what">
          <h2 id="what" className="text-xl font-medium tracking-tight">
            What this site is
          </h2>
          <p className="mt-2">
            Disease Observer shows maps and charts of infectious disease cases in England, so
            that anyone can see what is being reported and where.
          </p>
        </section>
        <section aria-labelledby="data">
          <h2 id="data" className="text-xl font-medium tracking-tight">
            Where the data comes from
          </h2>
          <p className="mt-2">
            The figures come from the UK Health Security Agency (UKHSA) data dashboard, and the
            area boundaries from the Office for National Statistics. See{" "}
            <Link href="/sources" className={strongLink}>
              sources and licences
            </Link>{" "}
            for the full credits.
          </p>
        </section>
        <section aria-labelledby="provisional">
          <h2 id="provisional" className="text-xl font-medium tracking-tight">
            Recent figures are provisional
          </h2>
          <p className="mt-2">
            Cases take time to be reported, so the most recent figures are marked as
            provisional and are usually revised upwards. This site refreshes its data about
            once a day, and the sources publish new figures weekly.
          </p>
        </section>
        <section aria-labelledby="advice">
          <h2 id="advice" className="text-xl font-medium tracking-tight">
            Not medical advice
          </h2>
          <p className="mt-2">
            This site is for information only. It cannot tell you whether you are ill or at
            risk. If you are worried about your health, speak to a doctor or call NHS 111.
          </p>
        </section>
      </div>
    </main>
  );
}
