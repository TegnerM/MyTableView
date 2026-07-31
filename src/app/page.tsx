import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Fraunces } from "next/font/google";
import { EmailLink } from "@/components/EmailLink";
import {
  getLandingStrings,
  resolveLandingLocale,
} from "@/lib/i18n/landing";
import "./home.css";

/**
 * Marketing landing page.
 *
 * Fully localised: every visible string comes from the landing
 * dictionary, and the locale is resolved per-request from
 * Accept-Language (override with ?lang=es for testing). Adding a
 * language touches only src/lib/i18n/landing.ts.
 *
 * All product data shown is service data — requests, response times,
 * repeat asks. Nothing here implies POS/order/revenue access.
 */

export const dynamic = "force-dynamic";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const TABLE_STATUS_COLORS = ["#3fb950", "#d4a017", "#e5484d", "#b8b1a5"];
const TABLE_STATUS_VALUES = [9, 3, 1, 13];

type PageProps = {
  searchParams: Promise<{ lang?: string; code?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const { lang, code } = await searchParams;

  // Supabase's default confirmation-email flow redirects here with
  // ?code=... — forward it to the auth callback, which exchanges it
  // for a session and continues signup. Without this, a confirming
  // user just lands on the marketing page, signed out.
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const headerList = await headers();
  const locale = resolveLandingLocale(lang, headerList.get("accept-language"));
  const t = getLandingStrings(locale);

  const liveRequests = [
    { table: `${t.floor.table} 12`, ask: t.floor.askDrinks, when: t.floor.now, tone: "new" },
    { table: `${t.floor.table} 8`, ask: t.floor.askBill, when: t.floor.twoMin, tone: "seen" },
    { table: `${t.floor.table} 3`, ask: t.floor.askAssist, when: t.floor.twelveMin, tone: "late" },
  ];

  const glanceStats = [
    { label: t.glance.statRequests, value: "132", delta: "↑ 12%" },
    { label: t.glance.statResponse, value: "1m 48s", delta: "↓ 23%" },
    { label: t.glance.statUnder, value: "86%", delta: "↑ 9%" },
    { label: t.glance.statTwice, value: "4", delta: "↓ 6" },
  ];

  const tableStatus = [
    t.glance.legendGood,
    t.glance.legendWaiting,
    t.glance.legendOverdue,
    t.glance.legendFree,
  ].map((label, i) => ({
    label,
    value: TABLE_STATUS_VALUES[i],
    color: TABLE_STATUS_COLORS[i],
  }));

  const topRequests = [
    { name: t.glance.itemNapkins, count: 12 },
    { name: t.glance.itemWater, count: 10 },
    { name: t.glance.itemBill, count: 8 },
    { name: t.glance.itemRound, count: 7 },
  ];

  const steps = [
    { title: t.how.step1Title, body: t.how.step1Body },
    { title: t.how.step2Title, body: t.how.step2Body },
    { title: t.how.step3Title, body: t.how.step3Body },
    { title: t.how.step4Title, body: t.how.step4Body },
  ];

  const clockMarks = [
    { time: t.how.mark0Time, text: t.how.mark0Text },
    { time: t.how.mark5Time, text: t.how.mark5Text },
    { time: t.how.mark10Time, text: t.how.mark10Text },
  ];

  const posPartners = [
    "Lightspeed",
    "Square",
    "Toast",
    "Revel",
    "NCR Voyix",
    "Oracle Micros",
  ];

  return (
    <div className="lp" lang={locale}>
      <header className="lp-header">
        <Link href="/" className="lp-logo" aria-label="MyTableView home">
          <Monogram />
          <span className="lp-wordmark">
            <span>mytable</span>
            <em>view</em>
          </span>
        </Link>

        <nav className="lp-nav" aria-label="Main">
          <a href="#features">{t.nav.features}</a>
          <a href="#how-it-works">{t.nav.howItWorks}</a>
          <a href="#get-started">{t.nav.pricing}</a>
          <a href="#integrations">{t.nav.resources}</a>
        </nav>

        <div className="lp-header-cta">
          <Link href="/staff/sign-in" className="lp-link-quiet">
            {t.nav.logIn}
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <h1 className={`${fraunces.className} lp-title`}>
              {t.hero.titleLine1}
              <br />
              <em>{t.hero.titleLine2}</em>
            </h1>

            <p className="lp-sub">{t.hero.sub}</p>

            <div className="lp-pos-note">
              <PosIcon />
              <p>
                {t.hero.posLine1}
                <br />
                <strong>{t.hero.posLine2}</strong>
              </p>
            </div>

            <div className="lp-cta-row">
              <a
                href="#how-it-works"
                className="lp-btn lp-btn-primary lp-btn-large"
              >
                {t.hero.ctaHow}
              </a>
              <a href="#features" className="lp-btn lp-btn-ghost lp-btn-large">
                {t.hero.ctaWho}
              </a>
            </div>

            <ul className="lp-trust-row">
              <li>
                <CardIcon /> {t.hero.trustCard}
              </li>
              <li>
                <ClockIcon /> {t.hero.trustSetup}
              </li>
              <li>
                <CancelIcon /> {t.hero.trustCancel}
              </li>
            </ul>
          </div>

          <div className="lp-hero-visual">
            <Image
              className="lp-hero-photo"
              src="/landing-hero.jpg"
              alt={t.hero.photoAlt}
              fill
              priority
              sizes="(max-width: 960px) 100vw, 58vw"
            />

            <div className="lp-glance-card">
              <div className="lp-glance-head">
                <p>{t.glance.title}</p>
                <span className="lp-glance-chip">{t.glance.chip}</span>
              </div>

              <div className="lp-glance-stats">
                {glanceStats.map((stat) => (
                  <div key={stat.label} className="lp-glance-stat">
                    <span className="lp-glance-label">{stat.label}</span>
                    <span className="lp-glance-value">{stat.value}</span>
                    <span className="lp-glance-delta">{stat.delta}</span>
                  </div>
                ))}
              </div>

              <div className="lp-glance-body">
                <div className="lp-glance-status">
                  <p className="lp-glance-subhead">{t.glance.tableStatus}</p>
                  <div className="lp-donut-row">
                    <Donut slices={tableStatus} />
                    <ul className="lp-donut-legend">
                      {tableStatus.map((slice) => (
                        <li key={slice.label}>
                          <i style={{ background: slice.color }} />
                          {slice.label}
                          <span>{slice.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="lp-glance-top">
                  <p className="lp-glance-subhead">{t.glance.topRequests}</p>
                  <ul className="lp-top-items">
                    {topRequests.map((item) => (
                      <li key={item.name}>
                        {item.name}
                        <span>{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-features" id="features">
          <article className="lp-feature lp-feature-guest">
            <div className="lp-feature-text lp-feature-guest-copy">
              <span className="lp-feature-icon lp-feature-guest-icon" data-tone="teal">
                <GuestsIcon />
              </span>
              <p className="lp-feature-eyebrow" data-tone="teal">
                {t.features.guestsEyebrow}
              </p>
              <h2>{t.features.guestsTitle}</h2>
              <p className="lp-feature-copy">{t.features.guestsCopy}</p>
            </div>

            <div className="lp-device lp-phone-shot lp-feature-guest-phone">
              <div className="lp-feature-guest-glow" aria-hidden="true" />
              <Image
                src="/guest-phone.png"
                alt={t.features.phoneAlt}
                width={574}
                height={1200}
                sizes="(max-width: 720px) 78vw, (max-width: 1100px) 38vw, 360px"
                priority={false}
              />
            </div>
          </article>

          <h2 className={`${fraunces.className} lp-features-pair-title`}>
            {t.features.pairTitle}
          </h2>

          <article className="lp-feature">
            <div className="lp-feature-text">
              <span className="lp-feature-icon" data-tone="gold">
                <StaffIcon />
              </span>
              <p className="lp-feature-eyebrow" data-tone="gold">
                {t.features.staffEyebrow}
              </p>
              <p className="lp-feature-copy">{t.features.staffCopy}</p>
            </div>

            <div className="lp-device lp-tablet" aria-hidden="true">
              <p className="lp-orders-head">{t.floor.title}</p>
              {liveRequests.map((request) => (
                <div
                  key={request.table}
                  className="lp-order"
                  data-tone={request.tone}
                >
                  <div className="lp-order-top">
                    <span>{request.table}</span>
                    <span className="lp-order-when">{request.when}</span>
                  </div>
                  <p className="lp-order-item">{request.ask}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="lp-feature">
            <div className="lp-feature-text">
              <span className="lp-feature-icon" data-tone="teal">
                <ChartIcon />
              </span>
              <p className="lp-feature-eyebrow" data-tone="teal">
                {t.features.bizEyebrow}
              </p>
              <p className="lp-feature-copy">{t.features.bizCopy}</p>
            </div>

            <div className="lp-device lp-laptop" aria-hidden="true">
              <div className="lp-laptop-chips">
                {glanceStats.map((stat) => (
                  <div key={stat.label} className="lp-laptop-chip">
                    <span>{stat.value}</span>
                    <em>{stat.delta}</em>
                  </div>
                ))}
              </div>
              <div className="lp-laptop-bars">
                {[42, 58, 47, 66, 74, 61, 82].map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
              <p className="lp-laptop-caption">{t.features.chartCaption}</p>
            </div>
          </article>
        </section>

        <section className="lp-how" id="how-it-works">
          <div className="lp-how-head">
            <h2 className={fraunces.className}>{t.how.title}</h2>
            <p>{t.how.sub}</p>
          </div>

          <ol className="lp-steps">
            {steps.map((step, index) => (
              <li key={step.title} className="lp-step">
                <span className="lp-step-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>

          {/* The escalation clock — the part a demo would demonstrate. */}
          <div className="lp-clock" aria-label={t.how.clockAria}>
            <p className="lp-clock-title">{t.how.clockTitle}</p>
            <div className="lp-clock-bar">
              <span className="lp-clock-seg" data-zone="good" />
              <span className="lp-clock-seg" data-zone="waiting" />
              <span className="lp-clock-seg" data-zone="overdue" />
            </div>
            <div className="lp-clock-marks">
              {clockMarks.map((mark) => (
                <div key={mark.time}>
                  <strong>{mark.time}</strong>
                  <span>{mark.text}</span>
                </div>
              ))}
            </div>
            <p className="lp-clock-note">
              {t.how.noteBefore}
              <em>{t.how.noteEm}</em>
              {t.how.noteAfter}
            </p>
          </div>
        </section>

        <section className="lp-integrations" id="integrations">
          <div className="lp-integrations-intro">
            <span className="lp-integrations-icon">
              <PosIcon />
            </span>
            <div>
              <h2>{t.pos.title}</h2>
              <p>
                {t.pos.line1}
                <br />
                {t.pos.line2}
              </p>
            </div>
          </div>
          <ul className="lp-partner-row">
            {posPartners.map((partner) => (
              <li key={partner}>{partner}</li>
            ))}
          </ul>
        </section>

        <section className="lp-demo" id="get-started">
          <h2 className={fraunces.className}>{t.demo.title}</h2>
          <p>{t.demo.body}</p>
          <Link
            href="/staff/sign-up"
            className="lp-btn lp-btn-primary lp-btn-large"
          >
            {t.demo.cta}
          </Link>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} MyTableView</span>
        <EmailLink showAddress />
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- SVGs */

function Monogram() {
  return (
    <svg className="lp-monogram" viewBox="0 0 44 44" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="40"
        height="40"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M12 31 V14 l10 11 10-11 v17"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 31 l4 5 4-5"
        fill="none"
        stroke="#12a89a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Donut({
  slices,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 15.9155; // circumference ≈ 100 → dash values are percentages
  let offset = 25; // start at 12 o'clock

  return (
    <svg className="lp-donut" viewBox="0 0 42 42" aria-hidden="true">
      {slices.map((slice) => {
        const share = (slice.value / total) * 100;
        const circle = (
          <circle
            key={slice.label}
            cx="21"
            cy="21"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="6"
            strokeDasharray={`${share - 1.5} ${100 - share + 1.5}`}
            strokeDashoffset={offset}
          />
        );
        offset -= share;
        return circle;
      })}
    </svg>
  );
}

function PosIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 8h4M7 11h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 20h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.7-3 2.8-4.5 5.5-4.5s4.8 1.5 5.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 14.8c2.6 0 4.3 1.3 5 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <path
        d="M4.5 17a7.5 7.5 0 0 1 15 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M3 17h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 9.5V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
