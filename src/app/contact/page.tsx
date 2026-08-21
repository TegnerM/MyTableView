import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Fraunces } from "next/font/google";
import { ContactForm } from "@/components/ContactForm";
import { EmailLink } from "@/components/EmailLink";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import { TrackBeacon } from "@/components/TrackBeacon";
import { getLandingStrings, resolveLandingLocale } from "@/lib/i18n/landing";
import "../home.css";
import "../legal.css";
import "./contact.css";

/**
 * /contact — a real contact page instead of a bare mailto link.
 * A form that delivers to the inbox (Reply-To = the sender), with the
 * address itself shown alongside for people who prefer their own mail
 * client. Same ivory/navy/orange language as the landing page.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — MyTableView",
  description:
    "Questions about MyTableView, pricing, or a demo for your restaurant, bar or hotel? Send us a message — a real person answers.",
};

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function ContactPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const locale = resolveLandingLocale(lang, headerList.get("accept-language"));
  const t = getLandingStrings(locale);
  const c = t.contactPage;

  return (
    <div className="lp" lang={locale}>
      <TrackBeacon />

      <header className="lp-header">
        <Link href="/" className="lp-logo" aria-label="MyTableView home">
          <span className="lp-mark" aria-hidden="true">
            <i />
          </span>
          My<em>Table</em>View
        </Link>

        <nav className="lp-nav" aria-label="Main">
          <Link href="/#solutions">{t.nav.products}</Link>
          <Link href="/#features">{t.nav.features}</Link>
          <Link href="/#pricing">{t.nav.pricing}</Link>
          <span className="lp-nav-contact" aria-current="page">
            {t.nav.contact}
          </span>
        </nav>

        <div className="lp-header-cta">
          <Link href="/staff/sign-in" className="lp-btn lp-btn-ghost">
            {t.nav.login}
          </Link>
          <Link href="/staff/sign-up" className="lp-btn lp-btn-orange">
            {t.nav.tryFree}
          </Link>
        </div>
      </header>

      <main className="lp-contact">
        <div className="lp-w lp-contact-in">
          <div className="lp-contact-copy">
            <h1 className={fraunces.className}>{c.title}</h1>
            <p className="lp-contact-sub">{c.sub}</p>

            <div className="lp-contact-alt">
              <h2>{c.altTitle}</h2>
              <p>{c.altBody}</p>
              <div className="lp-contact-ways">
                <EmailLink showAddress className="lp-contact-email" />
                <WhatsAppLink className="lp-wa-btn">{c.whatsapp}</WhatsAppLink>
              </div>
            </div>

            <Link href="/" className="lp-contact-back">
              ← {c.backHome}
            </Link>
          </div>

          <div className="lp-contact-card">
            <ContactForm
              strings={{
                name: c.name,
                email: c.email,
                business: c.business,
                message: c.message,
                send: c.send,
                sending: c.sending,
                sentTitle: c.sentTitle,
                sentBody: c.sentBody,
                error: c.error,
              }}
            />
          </div>
        </div>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} MyTableView</span>
        <span className="lp-footer-links">
          <Link href="/">{c.backHome}</Link>
          <Link href="/terms">{t.nav.terms}</Link>
          <Link href="/privacy">{t.nav.privacy}</Link>
        </span>
      </footer>
    </div>
  );
}
