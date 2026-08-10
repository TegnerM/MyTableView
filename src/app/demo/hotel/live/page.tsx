import type { Metadata } from "next";
import { headers } from "next/headers";
import { TrackBeacon } from "@/components/TrackBeacon";
import { HotelDemo } from "@/components/HotelDemo";
import { DemoHeader } from "@/components/demo/DemoHeader";
import { getDemoStrings, resolveDemoLocale } from "@/lib/i18n/demo";
import "../../demo-explainer.css";
import "../../demo.css";
import "../hotel-demo.css";

/**
 * /demo/hotel/live — the playable Room 412 simulator on its own
 * page, reached from the "Open the live demo" box on /demo/hotel.
 * Entirely client-simulated.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live hotel demo — MyTableView",
  description:
    "Play the hotel: ask for towels, report the AC with a note, order breakfast from Room 412 — and watch it land on the staff screens instantly.",
};

type PageProps = { searchParams: Promise<{ lang?: string }> };

export default async function LiveHotelDemoPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const t = getDemoStrings(
    resolveDemoLocale(lang, headerList.get("accept-language"))
  );

  return (
    <div className="dx">
      <TrackBeacon />
      <DemoHeader active="hotel" t={t} />
      <div className="dm-page">
        <HotelDemo />
      </div>
    </div>
  );
}
