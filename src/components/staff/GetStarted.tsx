"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StaffStrings } from "@/lib/i18n/staff";

/**
 * The "Get started" card — the first thing a brand-new owner sees on
 * Overview. Four steps that tick themselves off by watching real data;
 * no "mark as done" buttons anywhere:
 *
 *   1. tables exist        → drawn in Layout
 *   2. a code is assigned  → NFC tag claimed or QR page printed
 *   3. a request has landed→ the "Send test request" magic moment
 *   4. a teammate joined   → staff count above one
 *
 * The server computes the step states on every load, so realtime
 * refreshes tick steps live while the owner watches. When all four are
 * done the server stamps the dismissal itself and the card leaves on
 * its own; "Don't show this again" is the early exit.
 */

export type GetStartedSteps = {
  tables: boolean;
  codes: boolean;
  request: boolean;
  team: boolean;
};

export function GetStarted({
  steps,
  t,
}: {
  steps: GetStartedSteps;
  t: StaffStrings;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);

  const g = t.getStarted;
  const done = [steps.tables, steps.codes, steps.request, steps.team].filter(
    Boolean
  ).length;
  const allDone = done === 4;
  // First incomplete step gets the highlight.
  const current = !steps.tables
    ? 1
    : !steps.codes
      ? 2
      : !steps.request
        ? 3
        : 4;

  const post = async (action: "test_request" | "dismiss") => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/staff/get-started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (!response.ok || !payload?.ok) {
        setFailed(true);
        return;
      }
      if (action === "dismiss") {
        setHidden(true);
      }
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <section className="mtv-gs" aria-label={g.title}>
      <header className="mtv-gs-head">
        <div
          className="mtv-gs-ring"
          style={{
            background: `conic-gradient(var(--mtv-teal) ${done * 25}%, var(--mtv-line) 0)`,
          }}
          aria-hidden="true"
        >
          <span>{done}/4</span>
        </div>
        <div>
          <h2>{g.title}</h2>
          <p>{g.sub}</p>
        </div>
      </header>

      <ol className="mtv-gs-steps">
        <Step done={steps.tables} now={current === 1 && !allDone} label={g.step1}>
          {!steps.tables ? (
            <Link href="/staff/layout" className="mtv-gs-link">
              {g.step1Link}
            </Link>
          ) : null}
        </Step>

        <Step done={steps.codes} now={current === 2 && !allDone} label={g.step2}>
          {!steps.codes ? (
            <Link href="/staff/qr" className="mtv-gs-link">
              {g.step2Link}
            </Link>
          ) : null}
        </Step>

        <Step
          done={steps.request}
          now={current === 3 && !allDone}
          label={g.step3}
        >
          {!steps.request ? (
            <div className="mtv-gs-action">
              <p>{steps.tables ? g.step3Sub : g.step3NeedsTables}</p>
              <button
                type="button"
                className="mtv-btn mtv-btn-primary"
                disabled={busy || !steps.tables}
                onClick={() => void post("test_request")}
              >
                {busy ? g.step3Busy : g.step3Btn}
              </button>
            </div>
          ) : null}
        </Step>

        <Step done={steps.team} now={current === 4 && !allDone} label={g.step4}>
          {!steps.team ? (
            <Link href="/staff/settings" className="mtv-gs-link">
              {g.step4Link}
            </Link>
          ) : null}
        </Step>
      </ol>

      {failed ? <p className="mtv-gs-error">{g.error}</p> : null}

      {allDone ? (
        <p className="mtv-gs-done">{g.allDone}</p>
      ) : (
        <button
          type="button"
          className="mtv-gs-dismiss"
          disabled={busy}
          onClick={() => void post("dismiss")}
        >
          {g.dismiss}
        </button>
      )}
    </section>
  );
}

function Step({
  done,
  now,
  label,
  children,
}: {
  done: boolean;
  now: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <li
      className="mtv-gs-step"
      data-done={done ? "true" : "false"}
      data-now={now ? "true" : "false"}
    >
      <span className="mtv-gs-mark" aria-hidden="true">
        {done ? "✓" : ""}
      </span>
      <div className="mtv-gs-step-body">
        <span className="mtv-gs-label">{label}</span>
        {children}
      </div>
    </li>
  );
}
