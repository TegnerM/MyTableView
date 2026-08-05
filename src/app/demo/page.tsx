import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { TrackBeacon } from "@/components/TrackBeacon";
import { DemoInteractive } from "@/components/DemoInteractive";
import "./demo.css";

/**
 * /demo — play both sides of MyTableView in the browser.
 *
 * Entirely client-simulated: no venue, no database rows, no cleanup.
 * The TrackBeacon reports the visit, so /demo traffic (and any
 * ?ref= / ?rmc= source that led here) shows up in admin → Traffic
 * exactly like landing-page visits do.
 */

export const metadata: Metadata = {
  title: "Live demo — MyTableView",
  description:
    "Play the guest and the staff at the same time. Tap for service on the guest phone and watch it land on the live floor — no sign-up needed.",
};

export default function DemoPage() {
  return (
    <div className="dm-page">
      <TrackBeacon />

      <header className="dm-header">
        <Link href="/" aria-label="MyTableView home">
          <BrandMark className="mtv-brand" />
        </Link>
        <Link href="/staff/sign-up" className="dm-header-cta">
          Start your 14-day free trial
        </Link>
      </header>

      <section className="dm-intro">
        <h1>Play both sides of the table</h1>
        <p>
          On the left you&apos;re the guest — tap the phone like you just
          tapped the NFC tag on table 7. On the right you&apos;re the staff:
          the wall tablet and the waiter&apos;s phone react the same instant.
          Nothing to install, nothing to sign up for.
        </p>
      </section>

      <DemoInteractive />
    </div>
  );
}
