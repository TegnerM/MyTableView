import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import { DemoInteractive } from "@/components/DemoInteractive";
import {
  DemoHeader,
  DemoSteps,
  DemoBenefits,
  DemoLiveBox,
} from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "./demo-explainer.css";
import "./demo.css";

/**
 * /demo — the Restaurant demo (approved warm explainer design).
 *
 * The 4-step story first — photo, guest phone, live floor, waiter
 * phone — then the benefits, then the ORIGINAL interactive simulator
 * under #try: entirely client-simulated, no venue, no database rows.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Restaurant demo — MyTableView",
  description:
    "See how a guest request flows from the table to the waiter in real time — then play both sides yourself, live in the browser. No sign-up needed.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function DemoPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );
  const s = t.rest;

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="restaurant" t={t} />

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

        {/* 3 — the live floor tablet */}
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
            {[8, 9, 10].map((n) => (
              <div key={n} className="dx-tbl">{n}</div>
            ))}
            <div className="dx-tbl dx-tbl-late">11</div>
            <div className="dx-tbl">12</div>
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

        {/* 4 — the waiter phone */}
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

      <DemoBenefits
        items={[
          { t: s.b1t, d: s.b1d, icon: "heart" },
          { t: s.b2t, d: s.b2d, icon: "spark" },
          { t: s.b3t, d: s.b3d, icon: "clock" },
          { t: s.b4t, d: s.b4d, icon: "chart" },
        ]}
      />

      <DemoLiveBox title={t.live.title} sub={s.liveSub} btn={t.live.btn} />

      {/* The original playable simulator — both sides, in-browser. */}
      <div id="try" className="dm-page">
        <DemoInteractive />
      </div>
    </div>
  );
}
