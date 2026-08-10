import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import {
  DemoHeader,
  DemoSteps,
  DemoBenefits,
} from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../demo/demo-explainer.css";

/**
 * /how-it-works — the answer to the landing page's "See How It Works":
 * the one flow every venue shares (connect → ask → staff sees it →
 * handled), the three areas, and the doors into the three demos.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How it works — MyTableView",
  description:
    "From a tap at the table to a happy guest: how MyTableView carries a request from the guest's phone to the right staff member in real time.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function HowItWorksPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );
  const s = t.hiw;
  const h = t.hotel;

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="how" t={t} />

      <p className="dx-eyebrow">{s.eyebrow}</p>
      <h1 className="dx-title">{s.title}</h1>
      <p className="dx-sub">{s.sub}</p>

      <DemoSteps
        steps={[
          { t: s.s1t, d: s.s1d },
          { t: s.s2t, d: s.s2d },
          { t: s.s3t, d: s.s3d },
          { t: s.s4t, d: s.s4d },
        ]}
      />

      <div className="dx-visuals">
        {/* 1 — the table */}
        <div className="dx-shot">
          <Image
            src="/landing/card-restaurant.jpg"
            alt=""
            fill
            sizes="(max-width: 1060px) 90vw, 22rem"
          />
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 2 — the guest phone */}
        <div className="dx-phone">
          <div className="dx-ptop">9:41</div>
          <div className="dx-pvenue">Beach Club Aurora</div>
          <div className="dx-pline">Table 7 · How can we help?</div>
          <div className="dx-pact"><i>🍽️</i><span><b>Menu</b><span>Browse and order food &amp; drinks</span></span></div>
          <div className="dx-pact"><i>🛎️</i><span><b>Need assistance</b><span>Get help from our staff</span></span></div>
          <div className="dx-pact"><i>🧾</i><span><b>Ask for the bill</b><span>We&apos;ll bring it to you</span></span></div>
          <div className="dx-pspacer" />
          <div className="dx-card dx-pfoot" style={{ textAlign: "center" }}>
            <span>Your request: <b className="dx-tag dx-tag-now">On the way</b></span>
          </div>
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 3 — the live floor */}
        <div className="dx-tab">
          <div className="dx-tabbar">
            <span>Main Dining Room</span>
            <span className="dx-live-dot">● Live</span>
          </div>
          <div className="dx-floorgrid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="dx-tbl">{n}</div>
            ))}
            <div className="dx-tbl dx-tbl-hot">7</div>
            {[8, 9, 10, 11, 12].map((n) => (
              <div key={n} className="dx-tbl">{n}</div>
            ))}
          </div>
          <div className="dx-legend">
            <span className="dx-tag-ok">● OK</span>
            <span className="dx-tag-warn">● 5+ min</span>
            <span className="dx-tag-late">● 10+ min</span>
          </div>
          <div className="dx-tabfoot">
            <div className="dx-card dx-card-hot" style={{ margin: 0, textAlign: "left" }}>
              <b>Table 7 — Need assistance</b>{" "}
              <span className="dx-tag dx-tag-now">0:05</span>
            </div>
          </div>
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 4 — the staff phone */}
        <div className="dx-phone">
          <div className="dx-ptop">9:41</div>
          <div className="dx-pvenue">My requests</div>
          <div className="dx-pline">Active (1) · Done</div>
          <div className="dx-card dx-card-hot">
            <b>Table 7 — Need assistance</b>
            <br />
            <span className="dx-tag dx-tag-now">0:05 · just now</span>
          </div>
          <div className="dx-pcta">✓ Mark as served</div>
          <div className="dx-pghost">View table</div>
          <div className="dx-pspacer" />
          <div className="dx-card dx-pfoot">
            <b>Today</b>
            <br />
            <span>14 requests · avg response 1m 48s</span>
          </div>
        </div>
      </div>

      {/* One platform. Three areas. */}
      <div className="dx-areas">
        <h2>{h.areasTitle}</h2>
        <div className="dx-arow">
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-restaurant.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>🍽 {h.aRest}</b>
              <ul>
                <li>{h.aRest1}</li>
                <li>{h.aRest2}</li>
                <li>{h.aRest3}</li>
                <li>{h.aRest4}</li>
              </ul>
            </div>
          </div>
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-bar.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>🍸 {h.aBar}</b>
              <ul>
                <li>{h.aBar1}</li>
                <li>{h.aBar2}</li>
                <li>{h.aBar3}</li>
                <li>{h.aBar4}</li>
              </ul>
            </div>
          </div>
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-hotel.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>🛏 {h.aRooms}</b>
              <ul>
                <li>{h.aRooms1}</li>
                <li>{h.aRooms2}</li>
                <li>{h.aRooms3}</li>
                <li>{h.aRooms4}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <DemoBenefits
        items={[
          { t: t.rest.b1t, d: t.rest.b1d, icon: "heart" },
          { t: t.rest.b2t, d: t.rest.b2d, icon: "spark" },
          { t: t.rest.b3t, d: t.rest.b3d, icon: "clock" },
          { t: t.rest.b4t, d: t.rest.b4d, icon: "chart" },
        ]}
      />

      {/* Doors into the three demos */}
      <div className="dx-wrap">
        <div className="dx-livebox">
          <span className="dx-livebox-icon" aria-hidden="true">▶</span>
          <div>
            <b>{s.demosTitle}</b>
            <p>{s.demosSub}</p>
          </div>
          <span className="dx-demolinks">
            <Link href="/demo" className="dx-btn dx-btn-ghost">
              {t.nav.restaurant}
            </Link>
            <Link href="/demo/ordering" className="dx-btn dx-btn-ghost">
              {t.nav.bar}
            </Link>
            <Link href="/demo/hotel" className="dx-btn dx-btn-orange">
              {t.nav.hotel}
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
