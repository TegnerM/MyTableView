import Link from "next/link";
import type { DemoStrings } from "@/lib/i18n/demo";

/**
 * The demo pages' shared header — the landing look with the three
 * demo tabs. Every link goes somewhere real: the tabs switch demos,
 * How It Works and Pricing anchor into the landing page, Log in and
 * Try It Free are the same two actions as everywhere else.
 */

type Props = {
  active: "restaurant" | "bar" | "hotel";
  t: DemoStrings;
};

export function DemoHeader({ active, t }: Props) {
  return (
    <header className="dx-header">
      <Link href="/" className="dx-logo" aria-label="MyTableView home">
        <span className="dx-mark" aria-hidden="true">
          <i />
        </span>
        My<em>Table</em>View
      </Link>

      <nav className="dx-nav" aria-label="Demos">
        <Link href="/demo" data-on={active === "restaurant" ? "true" : undefined}>
          {t.nav.restaurant}
        </Link>
        <Link href="/demo/ordering" data-on={active === "bar" ? "true" : undefined}>
          {t.nav.bar}
        </Link>
        <Link href="/demo/hotel" data-on={active === "hotel" ? "true" : undefined}>
          {t.nav.hotel}
        </Link>
        <Link href="/#features">{t.nav.how}</Link>
        <Link href="/#pricing">{t.nav.pricing}</Link>
      </nav>

      <span className="dx-header-cta">
        <Link href="/staff/sign-in" className="dx-btn dx-btn-ghost">
          {t.nav.login}
        </Link>
        <Link href="/staff/sign-up" className="dx-btn dx-btn-orange">
          {t.nav.tryFree}
        </Link>
      </span>
    </header>
  );
}

/** Numbered step headers above the visuals row. */
export function DemoSteps({
  steps,
}: {
  steps: { t: string; d: string }[];
}) {
  return (
    <div className="dx-steps">
      {steps.map((step, index) => (
        <div key={index} className="dx-step">
          <span className="dx-step-n" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <b>{step.t}</b>
            <p>{step.d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The four-benefit strip under the visuals. */
export function DemoBenefits({
  items,
}: {
  items: { t: string; d: string; icon: "heart" | "spark" | "clock" | "chart" }[];
}) {
  return (
    <div className="dx-wrap">
      <div className="dx-benefits">
        {items.map((item, index) => (
          <div key={index} className="dx-ben">
            <BenefitIcon kind={item.icon} />
            <div>
              <b>{item.t}</b>
              <p>{item.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenefitIcon({ kind }: { kind: "heart" | "spark" | "clock" | "chart" }) {
  const paths: Record<string, React.ReactNode> = {
    heart: (
      <path d="M10 17s-6.5-4.3-6.5-9A3.7 3.7 0 0 1 10 5.6 3.7 3.7 0 0 1 16.5 8c0 4.7-6.5 9-6.5 9Z" />
    ),
    spark: (
      <path d="M10 2v5M10 13v5M2 10h5M13 10h5M4.6 4.6l3 3M12.4 12.4l3 3M15.4 4.6l-3 3M7.6 12.4l-3 3" />
    ),
    clock: (
      <>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 5.5V10l3 2" />
      </>
    ),
    chart: <path d="M3 16.5 8 11l3 3 6-7M13 7h4v4" />,
  };
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

/** The "try it live" box that leads into the interactive simulator. */
export function DemoLiveBox({
  title,
  sub,
  btn,
}: {
  title: string;
  sub: string;
  btn: string;
}) {
  return (
    <div className="dx-wrap">
      <div className="dx-livebox">
        <span className="dx-livebox-icon" aria-hidden="true">▶</span>
        <div>
          <b>{title}</b>
          <p>{sub}</p>
        </div>
        <a href="#try" className="dx-btn dx-btn-orange">
          {btn}
        </a>
      </div>
    </div>
  );
}
