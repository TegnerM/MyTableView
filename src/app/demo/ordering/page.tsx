import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { TrackBeacon } from "@/components/TrackBeacon";
import { OrderingDemo } from "@/components/OrderingDemo";
import "../demo.css";
import "./ordering-demo.css";

/**
 * /demo/ordering — the ordering module, playable.
 *
 * Same rules as /demo: entirely client-simulated, no venue, no rows.
 * The visitor orders on the guest phone and watches the order split —
 * food to the kitchen screen, drinks to the bar screen, and the
 * pickup task to the waiter panel the moment a station rings Ready.
 */

export const metadata: Metadata = {
  title: "Ordering demo — MyTableView",
  description:
    "Order from the guest phone and watch it split live: food to the kitchen screen, drinks to the bar, and the pickup to the waiter — no sign-up needed.",
};

export default function OrderingDemoPage() {
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
        <h1>Every order finds its station</h1>
        <p>
          Play all four roles at once. Order food and drinks on the guest
          phone and watch the order split the moment you send it: the
          kitchen screen gets the food — only the food. The bar gets the
          drinks. And the waiters see nothing until a station rings
          <strong> Ready</strong> — then it&apos;s a single task: carry it,
          tap Delivered, done.
        </p>
        <p className="od-crosslink">
          <Link href="/demo">← Service-requests demo</Link>
          {" · "}
          <Link href="/demo/hotel">Hotel demo →</Link>
        </p>
      </section>

      <OrderingDemo />
    </div>
  );
}
