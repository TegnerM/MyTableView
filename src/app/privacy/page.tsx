import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { EmailLink } from "@/components/EmailLink";
import { TrackBeacon } from "@/components/TrackBeacon";
import "../home.css";
import "../legal.css";

/**
 * /privacy — what MyTableView actually collects and why, written to
 * match the product's real behaviour (no guest accounts, no ad
 * trackers, essential cookies only). English-only by design; the
 * binding version of a legal document should not fork per locale.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy — MyTableView",
  description:
    "What MyTableView collects, why, and your rights — for venue accounts and for guests who scan a table code.",
};

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const UPDATED = "21 August 2026";

export default function PrivacyPage() {
  return (
    <div className="lp" lang="en">
      <TrackBeacon />

      <header className="lp-header">
        <Link href="/" className="lp-logo" aria-label="MyTableView home">
          <span className="lp-mark" aria-hidden="true">
            <i />
          </span>
          My<em>Table</em>View
        </Link>
        <nav className="lp-nav" aria-label="Main">
          <Link href="/#solutions">Products</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="lp-header-cta">
          <Link href="/staff/sign-in" className="lp-btn lp-btn-ghost">
            Log in
          </Link>
          <Link href="/staff/sign-up" className="lp-btn lp-btn-orange">
            Try It Free
          </Link>
        </div>
      </header>

      <main className="lp-legal">
        <article className="lp-legal-doc">
          <h1 className={fraunces.className}>Privacy Policy</h1>
          <p className="lp-legal-updated">Last updated: {UPDATED}</p>

          <h2>1. Who we are</h2>
          <p>
            MyTableView ("we", "us") is a guest-service platform for
            restaurants, bars and hotels, operated as a sole
            proprietorship established in Spain. For anything in this
            policy, write to us at <EmailLink showAddress /> or through
            the <Link href="/contact">contact page</Link>.
          </p>
          <p>
            For data belonging to a venue's guests, the venue you visit
            is the data controller and we act as its processor; for
            venue accounts and this website, we are the controller.
          </p>

          <h2>2. If you run a venue (accounts)</h2>
          <p>When you create and use a MyTableView account we process:</p>
          <ul>
            <li>
              Your name, email address and password (stored by our
              authentication provider in hashed form — we never see it).
            </li>
            <li>
              Your venue's details: name, time zone, languages, menu,
              floor layout, settings.
            </li>
            <li>
              Team data you enter: the names and email addresses of
              staff you invite, their role, and when their screen last
              talked to the service.
            </li>
            <li>
              Subscription status. Payments are handled by Stripe — we
              never receive or store card numbers.
            </li>
            <li>
              How you arrived, if you followed an invite or referral
              link (a short code identifying the campaign or referrer).
            </li>
          </ul>

          <h2>3. If you are a guest at a venue</h2>
          <p>
            Guests do not create accounts, and we do not ask for your
            name, email or phone number. When you scan a table or room
            code, we record a table session for the venue: the table or
            room, timestamps, the requests you tap, the contents and
            total of any order you place, an optional note you write,
            and a party size if staff enter one. The venue uses this to
            run service and see its own statistics.
          </p>
          <p>
            Guest session data is not used for advertising, not used to
            profile you across venues, and never sold. The codes on
            tables are long random identifiers so nobody can guess
            another table's link.
          </p>

          <h2>4. Cookies and device storage</h2>
          <p>We use essential cookies only — no advertising or third-party tracking cookies:</p>
          <ul>
            <li>Sign-in session (staff accounts only).</li>
            <li>Which of your venues this device is working with.</li>
            <li>Your language choice.</li>
            <li>
              A short-lived attribution cookie if you arrive through an
              invite or referral link.
            </li>
            <li>
              Device preferences such as night mode, kept in your
              browser's local storage and never sent to us.
            </li>
          </ul>
          <p>
            We measure page views on our own website with a first-party
            beacon (page visited, coarse referrer). No third-party
            analytics or ad networks run on our pages.
          </p>

          <h2>5. Service providers</h2>
          <p>
            We use a small set of processors, each receiving only what
            its job requires: Vercel (website hosting), Supabase
            (database and authentication), Stripe (subscription
            billing), Resend (transactional email such as invites and
            trial reminders), and DeepL (machine translation of menu
            text — dish names and descriptions only, never personal
            data).
          </p>

          <h2>6. Legal bases</h2>
          <p>
            We process data to perform our contract with venues (running
            the service), on our legitimate interest in securing and
            improving the service and providing venues with their own
            service statistics, and on consent where the law requires
            it.
          </p>

          <h2>7. Retention</h2>
          <p>
            Account data is kept while the account exists. Service
            history (requests, orders, sessions) is kept so venues can
            see their statistics over time; it contains no direct guest
            identifiers. When an account is deleted we remove its data
            within 30 days, except what we must keep for legal or
            accounting reasons.
          </p>

          <h2>8. Your rights</h2>
          <p>
            Under the GDPR you may request access to, rectification or
            erasure of your data, restriction of processing, data
            portability, or object to processing. Write to{" "}
            <EmailLink showAddress /> and we will respond within one
            month. You may also lodge a complaint with the Spanish
            supervisory authority (AEPD, aepd.es) or the authority in
            your own country.
          </p>

          <h2>9. International transfers</h2>
          <p>
            Data is hosted within the EU/EEA where our providers offer
            it. Where a provider processes data outside the EEA, the
            transfer is covered by an adequacy decision or Standard
            Contractual Clauses.
          </p>

          <h2>10. Changes</h2>
          <p>
            If we change this policy in a meaningful way, we will note
            it here and, for material changes affecting venue accounts,
            tell you by email or inside the product.
          </p>
        </article>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} MyTableView</span>
        <span className="lp-footer-links">
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </span>
      </footer>
    </div>
  );
}
