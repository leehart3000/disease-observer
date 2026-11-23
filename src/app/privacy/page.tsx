import type { Metadata } from "next";
import { ExternalLink } from "@/components/ExternalLink";
import { textLink } from "@/components/link-styles";
import { canonicalFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Disease Observer does and does not collect about the people who visit it.",
  alternates: canonicalFor("/privacy"),
};

/** The privacy page: short and plain. It is static text. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-3 pb-8 sm:px-6 sm:pt-5 sm:pb-12">
      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Privacy</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Disease Observer has no accounts, no cookies and no forms. This page says what little
        is recorded when you visit.
      </p>
      <div className="mt-6 grid max-w-2xl gap-8">
        <section aria-labelledby="collect">
          <h2 id="collect" className="text-xl font-medium tracking-tight">
            What the site collects
          </h2>
          <p className="mt-2">
            Nothing is collected through forms, because the site has none. There are no accounts
            and the site sets no cookies.
          </p>
        </section>
        <section aria-labelledby="analytics">
          <h2 id="analytics" className="text-xl font-medium tracking-tight">
            Counting visits
          </h2>
          <p className="mt-2">
            To see which pages are used, the site uses Cloudflare Web Analytics. It counts page
            views without cookies and without personal identifiers. Read{" "}
            <ExternalLink className={textLink} href="https://www.cloudflare.com/privacypolicy/">
              Cloudflare’s privacy policy
            </ExternalLink>
            .
          </p>
        </section>
        <section aria-labelledby="hosting">
          <h2 id="hosting" className="text-xl font-medium tracking-tight">
            Hosting
          </h2>
          <p className="mt-2">
            The site is hosted by Vercel, which processes technical data such as IP addresses to
            serve and secure the site. Read{" "}
            <ExternalLink className={textLink} href="https://vercel.com/legal/privacy-policy">
              Vercel’s privacy policy
            </ExternalLink>
            .
          </p>
        </section>
        <section aria-labelledby="theme">
          <h2 id="theme" className="text-xl font-medium tracking-tight">
            Your theme choice
          </h2>
          <p className="mt-2">
            If you choose the light or dark theme, your choice is stored only in your own
            browser. It is not sent to the site.
          </p>
        </section>
        <section aria-labelledby="email">
          <h2 id="email" className="text-xl font-medium tracking-tight">
            Email
          </h2>
          <p className="mt-2">
            Emails sent to addresses at disease.observer are forwarded to the site owner.
          </p>
        </section>
        <section aria-labelledby="contact">
          <h2 id="contact" className="text-xl font-medium tracking-tight">
            Contact
          </h2>
          <p className="mt-2">
            For questions about privacy, write to{" "}
            <a href="mailto:privacy@disease.observer" className={textLink}>
              privacy@disease.observer
            </a>
            . The site is run by Lee Hart.
          </p>
        </section>
      </div>
    </main>
  );
}
