import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import {
  DemoHeader,
  DemoSteps,
  DemoBenefits,
  DemoLiveBox,
} from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../demo-explainer.css";
import "./hotel-demo.css";

/**
 * /demo/hotel — the Hotel demo (approved warm explainer design).
 *
 * The 4-step story — the room, guest phone, property overview, staff
 * phone — then "One platform. Three areas.", the benefits, and the
 * ORIGINAL interactive Room 412 simulator under #try.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hotel demo — MyTableView",
  description:
    "See how a hotel guest's request reaches the right team in real time — then play the guest in Room 412 and the staff yourself, live in the browser.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function HotelDemoPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );
  const s = t.hotel;

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="hotel" t={t} />

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
        {/* 1 — the room */}
        <div className="dx-shot">
          <Image
            src="/landing/card-hotel.jpg"
            alt=""
            fill
            sizes="(max-width: 1060px) 90vw, 22rem"
          />
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 2 — the guest phone */}
        <div className="dx-phone">
          <div className="dx-ptop">9:41</div>
          <div className="dx-pvenue">Grand Meridian</div>
          <div className="dx-pline">Room 307 · How can we help?</div>
          <div className="dx-pact"><i>🍽️</i><span><b>Room service</b><span>Order food and drinks</span></span></div>
          <div className="dx-pact"><i>🧺</i><span><b>Fresh towels</b><span>We&apos;ll bring new towels</span></span></div>
          <div className="dx-pact"><i>🛎️</i><span><b>Need assistance</b><span>Get help from our team</span></span></div>
          <div className="dx-pact"><i>🍷</i><span><b>Book a table for dinner</b><span>At the hotel restaurant</span></span></div>
          <div className="dx-pact"><i>🚕</i><span><b>Book a taxi</b><span>Usually here in ~10 min</span></span></div>
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 3 — the property overview */}
        <div className="dx-tab">
          <div className="dx-tabbar">
            <span>Property overview</span>
            <span>All floors ▾</span>
          </div>
          <div className="dx-ovcols">
            <div className="dx-ovcol dx-ovcol-rest">
              <b>RESTAURANT</b>
              <div className="dx-card">
                <b>Table 12</b>
                <br />
                <span>Dinner reservation · 2 min</span>
              </div>
            </div>
            <div className="dx-ovcol dx-ovcol-bar">
              <b>BAR</b>
              <div className="dx-card">
                <b>Table 5</b>
                <br />
                <span>2× Mojito · 1 min</span>
              </div>
            </div>
            <div className="dx-ovcol dx-ovcol-rooms">
              <b>ROOMS</b>
              <div className="dx-card dx-card-hot">
                <b>Room 307</b>
                <br />
                <span className="dx-tag dx-tag-now">Fresh towels · now</span>
              </div>
              <div className="dx-card">
                <b>Room 205</b>
                <br />
                <span>Room service · 6 min</span>
              </div>
            </div>
          </div>
          <div className="dx-tabfoot">6 open requests · avg response 1m 54s</div>
        </div>
        <div className="dx-arrow" aria-hidden="true">▸▸</div>

        {/* 4 — the staff phone */}
        <div className="dx-phone">
          <div className="dx-ptop">9:41</div>
          <div className="dx-pvenue">Open requests</div>
          <div className="dx-pline">All (3) · Rooms (2)</div>
          <div className="dx-card dx-card-hot">
            <b>Room 307 — Fresh towels</b>
            <br />
            <span className="dx-tag dx-tag-now">1 min · high priority</span>
          </div>
          <div className="dx-pcta">✓ Mark as completed</div>
          <div className="dx-card">
            <b>Room 205 — Room service</b>
            <br />
            <span>Club sandwich · 6 min</span>
          </div>
          <div className="dx-card">
            <b>Room 102 — Need assistance</b>
            <br />
            <span>8 min</span>
          </div>
        </div>
      </div>

      {/* One platform. Three areas. */}
      <div className="dx-areas">
        <h2>{s.areasTitle}</h2>
        <div className="dx-arow">
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-restaurant.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>🍽 {s.aRest}</b>
              <ul>
                <li>{s.aRest1}</li>
                <li>{s.aRest2}</li>
                <li>{s.aRest3}</li>
                <li>{s.aRest4}</li>
              </ul>
            </div>
          </div>
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-bar.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>🍸 {s.aBar}</b>
              <ul>
                <li>{s.aBar1}</li>
                <li>{s.aBar2}</li>
                <li>{s.aBar3}</li>
                <li>{s.aBar4}</li>
              </ul>
            </div>
          </div>
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-hotel.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>🛏 {s.aRooms}</b>
              <ul>
                <li>{s.aRooms1}</li>
                <li>{s.aRooms2}</li>
                <li>{s.aRooms3}</li>
                <li>{s.aRooms4}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <DemoBenefits
        items={[
          { t: s.b1t, d: s.b1d, icon: "heart" },
          { t: s.b2t, d: s.b2d, icon: "clock" },
          { t: s.b3t, d: s.b3d, icon: "spark" },
          { t: s.b4t, d: s.b4d, icon: "chart" },
        ]}
      />

      <DemoLiveBox title={t.live.title} sub={s.liveSub} btn={t.live.btn} href="/demo/hotel/live" />

      <div className="dx-note">
        <b>{s.note1}</b> {s.note2}
      </div>

    </div>
  );
}
