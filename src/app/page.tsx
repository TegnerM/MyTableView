import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Fraunces } from "next/font/google";
import { EmailLink } from "@/components/EmailLink";
import { TrackBeacon } from "@/components/TrackBeacon";
import { PLANS, type Plan } from "@/lib/billing/plans";
import { getLandingStrings, resolveLandingLocale } from "@/lib/i18n/landing";
import "./home.css";

/**
 * Marketing landing page — the 2026 redesign.
 *
 * "See every guest. Miss nothing." One hero, three solution cards
 * (Restaurant / Bar / Hotel), the product on real devices, the stats
 * band and a photo CTA. Fully localised; every visible string comes
 * from src/lib/i18n/landing.ts.
 */

export const dynamic = "force-dynamic";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

type PageProps = {
  searchParams: Promise<{ lang?: string; code?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const { lang, code } = await searchParams;

  // Supabase's confirmation-email flow redirects here with ?code=... —
  // forward it to the auth callback, which exchanges it for a session
  // and continues signup.
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const headerList = await headers();
  const locale = resolveLandingLocale(lang, headerList.get("accept-language"));
  const t = getLandingStrings(locale);

  const euro = (amount: number) =>
    new Intl.NumberFormat(locale === "no" ? "nb" : locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);

  const pricingTiers = [1, 3, 5, 10]
    .map((size) => {
      const monthly = PLANS.find(
        (plan) =>
          !plan.hotel && plan.maxVenues === size && plan.interval === "monthly"
      );
      const yearly = PLANS.find(
        (plan) =>
          !plan.hotel && plan.maxVenues === size && plan.interval === "yearly"
      );
      return monthly && yearly ? { size, monthly, yearly } : null;
    })
    .filter(
      (tier): tier is { size: number; monthly: Plan; yearly: Plan } =>
        tier !== null
    );

  const hotelMonthly = PLANS.find((plan) => plan.key === "hotel-monthly");

  const solutions = [
    {
      key: "restaurant",
      photo: "/landing/card-restaurant.jpg",
      photoClass: "",
      icon: <ForkIcon />,
      s: t.solRest,
      href: "/demo",
    },
    {
      key: "bar",
      photo: "/landing/card-bar.jpg",
      photoClass: "lp-photo-bar",
      icon: <MartiniIcon />,
      s: t.solBar,
      href: "/demo/ordering",
    },
    {
      key: "hotel",
      photo: "/landing/card-hotel.png",
      photoClass: "lp-photo-hotel",
      icon: <BellIcon />,
      s: t.solHotel,
      href: "/demo/hotel",
    },
  ];

  return (
    <div className="lp" lang={locale}>
      <TrackBeacon />

      {/* ------------------------------------------------ header */}
      <header className="lp-header">
        <Link href="/" className="lp-logo" aria-label="MyTableView home">
          <span className="lp-mark" aria-hidden="true">
            <i />
          </span>
          My<em>Table</em>View
        </Link>

        <nav className="lp-nav" aria-label="Main">
          <a href="#solutions">{t.nav.products}</a>
          <a href="#features">{t.nav.features}</a>
          <a href="#pricing">{t.nav.pricing}</a>
          <EmailLink className="lp-nav-contact">{t.nav.contact}</EmailLink>
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

      <main>
        {/* ------------------------------------------------ hero */}
        <section className="lp-hero">
          <div className="lp-w lp-hero-in">
            <div className="lp-hero-copy">
              <h1 className={fraunces.className}>
                {t.hero.title1}
                <br />
                <span className="lp-o">{t.hero.title2}</span>
              </h1>
              <p className="lp-hero-sub">{t.hero.sub}</p>
              <div className="lp-hero-btns">
                <a href="#features" className="lp-btn lp-btn-orange">
                  {t.hero.ctaHow}
                </a>
                <a href="#solutions" className="lp-btn lp-btn-outline">
                  {t.hero.ctaProducts}
                </a>
              </div>
              <ul className="lp-trust">
                <li>
                  <HeartIcon /> {t.hero.trust1}
                </li>
                <li>
                  <ClockIcon /> {t.hero.trust2}
                </li>
                <li>
                  <ChartIcon /> {t.hero.trust3}
                </li>
              </ul>
            </div>
            <div className="lp-hero-photo">
              <Image
                src="/landing/hero.jpg"
                alt={t.hero.photoAlt}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 56vw"
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ solutions */}
        <section className="lp-solutions" id="solutions">
          <div className="lp-w">
            <p className="lp-eyebrow">{t.sol.eyebrow}</p>
            <h2 className={`${fraunces.className} lp-sol-title`}>
              {t.sol.title}
            </h2>
            <div className="lp-cards">
              {solutions.map((card) => (
                <article key={card.key} className="lp-card">
                  <div className={`lp-card-photo ${card.photoClass}`}>
                    <Image
                      src={card.photo}
                      alt=""
                      fill
                      sizes="(max-width: 900px) 100vw, 33vw"
                    />
                    <span className="lp-card-badge" aria-hidden="true">
                      {card.icon}
                    </span>
                  </div>
                  <div className="lp-card-body">
                    <h3 className={fraunces.className}>
                      {t.sol.brand}
                      <span className="lp-o">{card.s.name}</span>
                    </h3>
                    <p className="lp-card-desc">{card.s.desc}</p>
                    <ul className="lp-card-list">
                      <li>{card.s.f1}</li>
                      <li>{card.s.f2}</li>
                      <li>{card.s.f3}</li>
                      <li>{card.s.f4}</li>
                      <li>{card.s.f5}</li>
                    </ul>
                    <Link href={card.href} className="lp-btn lp-btn-navy">
                      {card.s.cta} →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ features */}
        <section className="lp-features" id="features">
          <div className="lp-w lp-feat-in">
            <div>
              <p className="lp-eyebrow lp-eyebrow-left">{t.feat.eyebrow}</p>
              <h2 className={fraunces.className}>
                {t.feat.title1}
                <br />
                {t.feat.title2}
              </h2>
              <p className="lp-feat-sub">{t.feat.sub}</p>
              <div className="lp-minis">
                <div>
                  <ShieldIcon />
                  {t.feat.mini1}
                </div>
                <div>
                  <HeartIcon />
                  {t.feat.mini2}
                </div>
                <div>
                  <DeviceIcon />
                  {t.feat.mini3}
                </div>
              </div>
              <a href="#solutions" className="lp-btn lp-btn-outline">
                {t.feat.cta}
              </a>
            </div>
            <div className="lp-devices" role="img" aria-label={t.feat.alt}>
              <div className="lp-dev-laptop">
                <Image src="/landing/laptop.png" alt="" width={1400} height={933} />
              </div>
              <div className="lp-dev-phone">
                <Image src="/landing/phone.png" alt="" width={574} height={1200} />
              </div>
              <div className="lp-dev-tab">
                <Image src="/landing/tablet.png" alt="" width={1100} height={733} />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ stats */}
        <section className="lp-stats">
          <div className="lp-w lp-stats-in">
            <div className="lp-stat">
              <span className="lp-stat-ic">
                <SparkIcon />
              </span>
              <span>
                <span className="lp-stat-t">{t.stats.s1t}</span>
                <span className={`${fraunces.className} lp-stat-v`}>
                  {t.stats.s1v}
                </span>
                <span className="lp-stat-u">{t.stats.s1u}</span>
              </span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-ic">
                <HeartIcon />
              </span>
              <span>
                <span className="lp-stat-t">{t.stats.s2t}</span>
                <span className={`${fraunces.className} lp-stat-v`}>
                  {t.stats.s2v}
                </span>
                <span className="lp-stat-u">{t.stats.s2u}</span>
              </span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-ic">
                <ClockIcon />
              </span>
              <span>
                <span className="lp-stat-t">{t.stats.s3t}</span>
                <span className={`${fraunces.className} lp-stat-v`}>
                  {t.stats.s3v}
                </span>
                <span className="lp-stat-u">{t.stats.s3u}</span>
              </span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-ic">
                <PenIcon />
              </span>
              <span>
                <span className="lp-stat-t">{t.stats.s4t}</span>
                <span className={`${fraunces.className} lp-stat-v lp-stat-v-small`}>
                  {t.stats.s4v}
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ pricing */}
        <section className="lp-pricing" id="pricing">
          <div className="lp-w">
            <h2 className={`${fraunces.className} lp-pricing-title`}>
              {t.pricing.title}
            </h2>
            <p className="lp-pricing-sub">{t.pricing.sub}</p>
            <div className="lp-price-grid">
              {pricingTiers.map(({ size, monthly, yearly }) => (
                <article key={size} className="lp-price-card">
                  <p className="lp-price-tier">
                    {size === 1
                      ? t.pricing.tier1
                      : t.pricing.tierN.replace("{n}", String(size))}
                  </p>
                  <p className="lp-price-main">
                    <strong className={fraunces.className}>
                      {euro(monthly.amount)}
                    </strong>
                    <span>{t.pricing.perMonth}</span>
                  </p>
                  <p className="lp-price-year">
                    {t.pricing.yearlyLine.replace(
                      "{price}",
                      euro(yearly.amount)
                    )}
                  </p>
                  <Link href="/staff/sign-up" className="lp-btn lp-btn-outline">
                    {t.pricing.cta}
                  </Link>
                </article>
              ))}
            </div>
            {hotelMonthly ? (
              <p className="lp-price-hotel-note">
                {t.pricing.hotelTier} — {euro(hotelMonthly.amount)}{" "}
                {t.pricing.perMonth} · {t.pricing.hotelIncluded}
              </p>
            ) : null}
            <p className="lp-pricing-foot">{t.pricing.foot}</p>
          </div>
        </section>

        {/* ------------------------------------------------ CTA */}
        <section className="lp-cta">
          <Image
            src="/landing/card-bar.jpg"
            alt=""
            fill
            sizes="100vw"
            className="lp-cta-bg"
          />
          <span className="lp-cta-ov" aria-hidden="true" />
          <div className="lp-w lp-cta-in">
            <div>
              <h2 className={fraunces.className}>{t.cta.title}</h2>
              <p>{t.cta.sub}</p>
            </div>
            <div className="lp-cta-btns">
              <Link href="/demo" className="lp-btn lp-btn-dark">
                {t.cta.rest}
              </Link>
              <Link href="/demo/ordering" className="lp-btn lp-btn-dark">
                {t.cta.bar}
              </Link>
              <Link href="/demo/hotel" className="lp-btn lp-btn-orange">
                {t.cta.hotel}
              </Link>
            </div>
          </div>
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

function icon(path: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" className="lp-icon" aria-hidden="true">
      {path}
    </svg>
  );
}

function HeartIcon() {
  return icon(
    <path
      d="M12 21c-5-3.4-8-6.8-8-10.5C4 7 6 5 8.5 5c1.6 0 3 .8 3.5 2 .5-1.2 1.9-2 3.5-2C18 5 20 7 20 10.5 20 14.2 17 17.6 12 21z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  );
}

function ClockIcon() {
  return icon(
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function ChartIcon() {
  return icon(
    <path
      d="M4 20V10M10 20V4M16 20v-8M21 20H3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  );
}

function ShieldIcon() {
  return icon(
    <path
      d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6l7-3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  );
}

function DeviceIcon() {
  return icon(
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function SparkIcon() {
  return icon(
    <path
      d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  );
}

function PenIcon() {
  return icon(
    <>
      <path
        d="M4 20l3.5-1 11-11a1.8 1.8 0 0 0-2.5-2.5l-11 11L4 20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l2.5 2.5" stroke="currentColor" strokeWidth="1.8" />
    </>
  );
}

function ForkIcon() {
  return icon(
    <path
      d="M8 3v7a2 2 0 0 0 2 2v9M8 3v5M6 3v5M16 3c-1.5 1-2.5 3-2.5 5.5 0 2 .8 3 2.5 3.5V21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  );
}

function MartiniIcon() {
  return icon(
    <path
      d="M4 5h16l-8 9-8-9zM12 14v6M8 20h8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function BellIcon() {
  return icon(
    <path
      d="M4 17a8 8 0 0 1 16 0M2.5 17h19M12 9V7M10 7h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  );
}
