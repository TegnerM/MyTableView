import type { Metadata } from "next";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import { OrderingDemo } from "@/components/OrderingDemo";
import { DemoHeader } from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../../demo-explainer.css";
import "../../demo.css";
import "../ordering-demo.css";

/**
 * /demo/ordering/live — the playable bar/ordering simulator on its
 * own page, reached from the "Open the live demo" box on
 * /demo/ordering. Entirely client-simulated.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live bar demo — MyTableView",
  description:
    "Order from the guest phone and watch it split live: food to the kitchen screen, drinks to the bar, and the pickup to the waiter — no sign-up needed.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function LiveOrderingDemoPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="bar" t={t} />
      <div className="dm-page">
        <OrderingDemo />
      </div>
    </div>
  );
}
