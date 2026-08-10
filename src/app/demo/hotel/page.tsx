import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import {
  DemoHeader,
  DemoSteps,
  DemoBenefits,
} from "@/components/demo/DemoHeader";
import { HotelLivePanels } from "@/components/demo/LiveDemoPanels";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../demo-explainer.css";
import "../demo-live.css";

/**
 * /demo/hotel — the Hotel demo, built PRECISELY to the approved
 * reference design, with LIVE panels: the guest phone (Room 307),
 * the Hotel Overview and the Open Requests staff phone really work.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hotel demo — MyTableView",
  description: "See how a hotel guest's request reaches the right team in real time — the phones on this page are live. No sign-up needed.",
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

      <HotelLivePanels photo="/landing/demo-photo-hotel.jpg" />

      {/* One platform. Three areas. */}
      <div className="dx-areas">
        <h2>{s.areasTitle}</h2>
        <div className="dx-arow">
          <div className="dx-area">
            <span className="dx-area-img">
              <Image src="/landing/card-restaurant.jpg" alt="" fill sizes="86px" />
            </span>
            <div>
              <b>{s.aRest}</b>
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
              <b>{s.aBar}</b>
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
              <b>{s.aRooms}</b>
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

      <div className="dx-note">
        <b>{s.note1}</b> {s.note2}
      </div>
    </div>
  );
}
