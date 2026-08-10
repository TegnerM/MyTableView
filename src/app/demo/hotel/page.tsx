import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { TrackBeacon } from "@/components/TrackBeacon";
import { HotelDemo } from "@/components/HotelDemo";
import "../demo.css";
import "./hotel-demo.css";

/**
 * /demo/hotel — the hotel edition, playable.
 *
 * Same rules as /demo: entirely client-simulated, no venue, no rows.
 * The visitor is the guest in Room 412 AND the hotel staff: towels,
 * a maintenance note, a room-service order — each tap lands on the
 * floor and the kitchen the same instant, and the staff buttons
 * answer back on the guest's status chip.
 */

export const metadata: Metadata = {
  title: "Hotel demo — MyTableView",
  description:
    "Play the hotel: ask for towels, report the AC with a note, order breakfast from Room 412 — and watch it land on the staff screens instantly. No sign-up needed.",
};

export default function HotelDemoPage() {
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
        <h1>Play the hotel — guest and staff at once</h1>
        <p>
          You&apos;re in Room 412. Ask for towels, report the AC with a
          note, order breakfast — and watch it land on the floor and the
          kitchen the same instant. Nothing to install, no sign-up.
        </p>
        <p className="od-crosslink">
          <Link href="/demo">← Service demo</Link>
          {" · "}
          <Link href="/demo/ordering">Ordering demo →</Link>
        </p>
      </section>

      <HotelDemo />
    </div>
  );
}
