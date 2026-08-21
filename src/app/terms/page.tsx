import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { EmailLink } from "@/components/EmailLink";
import { OperatorCard } from "@/components/OperatorCard";
import { TrackBeacon } from "@/components/TrackBeacon";
import "../home.css";
import "../legal.css";

/**
 * /terms — the service agreement for venue accounts, written to match
 * how the product actually works (14-day trial, Stripe billing, the
 * venue owns its menu and its guest relationship). English-only by
 * design; a legal document should not fork per locale.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service — MyTableView",
  description:
    "The agreement for using MyTableView: trials, subscriptions, the venue's responsibilities, availability and liability.",
};

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const UPDATED = "21 August 2026";

export default function TermsPage() {
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
          <h1 className={fraunces.className}>Terms of Service</h1>
          <p className="lp-legal-updated">Last updated: {UPDATED}</p>

          <h2>1. Who we are, and what this is</h2>
          <p>
            MyTableView ("we", "us") is operated as a sole
            proprietorship established in Spain. These terms are the
            agreement between us and the business that creates a
            MyTableView account (the "venue", "you"). By creating an
            account or using the service you accept them. Questions:{" "}
            <EmailLink showAddress /> or the{" "}
            <Link href="/contact">contact page</Link>.
          </p>
          <OperatorCard />

          <h2>2. The service</h2>
          <p>
            MyTableView lets guests at your tables or rooms scan a code
            to call staff, request the bill, browse your menu and place
            orders; your staff see these on live floor, kitchen and bar
            screens, and you get service statistics. We add, change and
            improve features over time.
          </p>

          <h2>3. Accounts and staff</h2>
          <p>
            Keep your account information accurate and your credentials
            safe; you are responsible for activity under your account.
            The account owner controls which staff are invited and what
            roles they hold, and is responsible for their use of the
            service. You must be entitled to act for the business you
            register.
          </p>

          <h2>4. Trial, subscriptions and payment</h2>
          <ul>
            <li>
              New venues get a 14-day free trial. No card is required to
              start, and the trial simply ends if you don't subscribe.
            </li>
            <li>
              Paid plans are billed monthly or yearly through Stripe.
              Prices are shown on the{" "}
              <Link href="/#pricing">pricing section</Link> and at
              checkout.
            </li>
            <li>
              You can cancel anytime; the subscription runs to the end
              of the paid period and does not renew. Fees already paid
              are not refunded except where the law requires it.
            </li>
            <li>
              We may change prices with at least 30 days' notice; changes
              apply from your next billing period.
            </li>
          </ul>

          <h2>5. Your responsibilities to your guests</h2>
          <p>
            The relationship with your guests is yours. In particular:
          </p>
          <ul>
            <li>
              You are responsible for your menu being accurate —
              prices, availability and, importantly,{" "}
              <strong>allergen information</strong>, which is your legal
              obligation as a food business.
            </li>
            <li>
              Guest orders and requests are placed with you, not with
              us; fulfilling them is your responsibility. Guests pay you
              directly at the venue — MyTableView does not process guest
              payments.
            </li>
            <li>
              You must use the service lawfully, including any rules
              that apply to alcohol service in your jurisdiction.
            </li>
          </ul>

          <h2>6. Acceptable use</h2>
          <p>
            Don't abuse the service: no attempts to break, overload,
            reverse-engineer or scan it; no reselling it as your own; no
            unlawful, misleading or infringing content in menus or
            settings. We may suspend accounts that put the service or
            other venues at risk.
          </p>

          <h2>7. Your content and data</h2>
          <p>
            Your menu, layout and settings remain yours. You grant us
            the licence needed to operate the service — to store,
            display and machine-translate your menu for your guests. How
            we handle personal data is described in the{" "}
            <Link href="/privacy">Privacy Policy</Link>, which forms
            part of these terms. For guest data recorded at your venue,
            you are the controller and we process it for you.
          </p>

          <h2>8. Availability</h2>
          <p>
            We run the service with care but provide it "as is", without
            a guarantee of uninterrupted availability. Maintenance,
            outages of underlying providers, or your own connectivity can
            interrupt it; keep a fallback for taking orders the
            old-fashioned way.
          </p>

          <h2>9. Liability</h2>
          <p>
            To the extent permitted by law, we are not liable for
            indirect damages such as lost revenue or lost data, and our
            total liability under this agreement is limited to the fees
            you paid us in the 12 months before the claim. Nothing in
            these terms excludes liability that cannot legally be
            excluded.
          </p>

          <h2>10. Termination</h2>
          <p>
            You may cancel and stop using the service at any time. We
            may suspend or terminate an account for material breach of
            these terms or non-payment, with notice where practicable.
            On termination we handle your data as described in the
            Privacy Policy.
          </p>

          <h2>11. Changes to these terms</h2>
          <p>
            We may update these terms; material changes will be
            announced by email or inside the product at least 30 days
            before they take effect. Continuing to use the service after
            that means you accept the new terms.
          </p>

          <h2>12. Governing law</h2>
          <p>
            These terms are governed by Spanish law, and disputes belong
            to the courts of Spain — without limiting any mandatory
            protections you enjoy under the law of your own country.
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
