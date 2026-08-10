import type { Metadata } from "next";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import { DemoInteractive } from "@/components/DemoInteractive";
import { DemoHeader } from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../demo-explainer.css";
import "../demo.css";

/**
 * /demo/live — the playable restaurant simulator on its own page,
 * reached from the "Open the live demo" box on /demo. Entirely
 * client-simulated: no venue, no database rows.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live restaurant demo — MyTableView",
  description:
    "Play the guest and the staff at the same time. Tap for service on the guest phone and watch it land on the live floor — no sign-up needed.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function LiveDemoPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="restaurant" t={t} />
      <div className="dm-page">
        <DemoInteractive />
      </div>
    </div>
  );
}
