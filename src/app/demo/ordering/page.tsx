import type { Metadata } from "next";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import {
  DemoHeader,
  DemoSteps,
  DemoBenefits,
} from "@/components/demo/DemoHeader";
import { BarLivePanels } from "@/components/demo/LiveDemoPanels";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../demo-explainer.css";
import "../demo-live.css";

/**
 * /demo — the Bar demo, built PRECISELY to the approved
 * reference design, with LIVE panels: the guest phone, the Bar
 * Overview and the bartender's screen really work.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bar demo — MyTableView",
  description: "See how an order goes straight from the guest's phone to the bar and gets served — the phones on this page are live. No sign-up needed.",
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

      <BarLivePanels photo="/landing/demo-photo-bar.jpg" />

      <div className="dl-minis">
        <div className="dl-mini"><i>📱</i><span><b>{s.m1t}</b><p>{s.m1d}</p></span></div>
        <div className="dl-mini"><i>👆</i><span><b>{s.m2t}</b><p>{s.m2d}</p></span></div>
        <div className="dl-mini"><i>👁</i><span><b>{s.m3t}</b><p>{s.m3d}</p></span></div>
        <div className="dl-mini"><i>✓</i><span><b>{s.m4t}</b><p>{s.m4d}</p></span></div>
      </div>

      <DemoBenefits
        items={[
          { t: s.b1t, d: s.b1d, icon: "heart" },
          { t: s.b2t, d: s.b2d, icon: "spark" },
          { t: s.b3t, d: s.b3d, icon: "clock" },
          { t: s.b4t, d: s.b4d, icon: "chart" },
        ]}
      />
    </div>
  );
}
