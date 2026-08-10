import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import { OrderingDemo } from "@/components/OrderingDemo";
import {
  DemoHeader,
  DemoSteps,
  DemoBenefits,
  DemoLiveBox,
} from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../demo-explainer.css";
import "../demo.css";
import "./ordering-demo.css";

/**
 * /demo/ordering — the Bar demo (approved warm explainer design).
 *
 * The 4-step story — beach table, guest phone, bar overview,
 * bartender phone — then the benefits, then the ORIGINAL interactive
 * ordering simulator under #try.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bar demo — MyTableView",
  description:
    "See how a round goes straight from the guest's phone to the bar and gets served — then play it yourself, live in the browser. No sign-up needed.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function OrderingDemoPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );
  const s = t.bar;

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="bar" t={t} />

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
        {/* 1 — the bar table */}
        <div className="dx-shot">
          <Image
            src="/landing/card-bar.jpg"
            alt=""
            fill
            sizes="(max-width: 1060px) 90vw, 22rem"
            style={{ objectPosition: "50% 62%" }}
          />
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 2 — the guest phone */}
        <div className="dx-phone">
          <div className="dx-ptop">9:41</div>
          <div className="dx-pvenue">Sunset Bar</div>
          <div className="dx-pline">Table 5 · How can we help?</div>
          <div className="dx-pact"><i>🍹</i><span><b>Order drinks</b><span>Browse drinks and bar bites</span></span></div>
          <div className="dx-pact"><i>🔁</i><span><b>Another round</b><span>Same again, one tap</span></span></div>
          <div className="dx-pact"><i>🛎️</i><span><b>Call the bar</b><span>Get help from our staff</span></span></div>
          <div className="dx-pact"><i>🧾</i><span><b>Ask for the bill</b><span>We&apos;ll close your tab</span></span></div>
          <div className="dx-pspacer" />
          <div className="dx-card dx-pfoot" style={{ textAlign: "center" }}>
            <span>Your order: <b className="dx-tag dx-tag-now">Being prepared</b></span>
          </div>
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 3 — the bar overview */}
        <div className="dx-tab">
          <div className="dx-tabbar">
            <span>Bar overview</span>
            <span className="dx-active-count">Active (4)</span>
          </div>
          <div className="dx-barorders">
            <div className="dx-card dx-card-hot">
              <b>TABLE 5</b> <span className="dx-tag dx-tag-now">0:03</span>
              <br />
              <span>2× Mojito · 1× Gin &amp; Tonic</span>
            </div>
            <div className="dx-card">
              <b>TABLE 2</b> <span className="dx-tag dx-tag-warn">1:18</span>
              <br />
              <span>2× Aperol Spritz</span>
            </div>
            <div className="dx-card">
              <b>TABLE 8</b> <span className="dx-tag dx-tag-warn">2:45</span>
              <br />
              <span>1× Margarita</span>
            </div>
            <div className="dx-card">
              <b>TABLE 1</b> <span className="dx-tag dx-tag-late">4:09</span>
              <br />
              <span>1× Rum &amp; Coke</span>
            </div>
          </div>
          <div className="dx-tabfoot">Last updated: just now</div>
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 4 — the bartender phone */}
        <div className="dx-phone">
          <div className="dx-ptop">9:41</div>
          <div className="dx-pvenue">Table 5 — Order drinks</div>
          <div className="dx-pline">
            <b className="dx-tag dx-tag-now">0:05</b>
          </div>
          <div className="dx-card">
            <b>Items requested</b>
            <br />
            <span>2× Mojito</span>
            <br />
            <span>1× Gin &amp; Tonic</span>
          </div>
          <div className="dx-pcta">✓ Mark as served</div>
          <div className="dx-pghost">View all orders</div>
          <div className="dx-pspacer" />
          <div className="dx-card dx-pfoot">
            <b>Tonight</b>
            <br />
            <span>32 rounds · busiest hour 22:00</span>
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

      {/* The original playable ordering simulator. */}
      <div id="try" className="dm-page">
        <OrderingDemo />
      </div>
    </div>
  );
}
