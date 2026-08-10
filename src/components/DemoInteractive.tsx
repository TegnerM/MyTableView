"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The interactive demo — /demo.
 *
 * Three screens, one simulated restaurant, zero backend: the visitor
 * plays the guest on the left phone, and watches the same tap land on
 * the wall tablet (floor plan) and the waiter's phone (list view) in
 * the same instant. Everything runs in browser memory; nothing here
 * touches Supabase, so a thousand curious visitors cost nothing and
 * can never pollute real data.
 *
 * Fidelity rules:
 * - Guest side mirrors the real /t/[tagId] screen: same five default
 *   request types (live DB seed), same gold theme, same "we heard you
 *   then get out of the way" confirmation, same two-question rating
 *   card after the bill.
 * - Staff side mirrors the real floor: same status buckets and colours
 *   (good / waiting / overdue), same list sorting. Ambient tables age
 *   in real minutes; the visitor's own request escalates on a sped-up
 *   clock (labelled) so they see the red state without waiting 10 min.
 */

/* ------------------------------------------------------------------ */
/* Request types — the venue defaults, verbatim from the live seed.    */
/* ------------------------------------------------------------------ */

type RequestCode = "drinks" | "dessert" | "coffee" | "bill" | "assistance";

const REQUEST_TYPES: {
  code: RequestCode;
  label: string;
  sublabel: string;
  closesSession: boolean;
}[] = [
  { code: "drinks", label: "Drinks", sublabel: "Another round?", closesSession: false },
  { code: "dessert", label: "Dessert Menu", sublabel: "See our selection", closesSession: false },
  { code: "coffee", label: "Coffee", sublabel: "Espresso, tea & more", closesSession: false },
  { code: "bill", label: "Request the Bill", sublabel: "When you are ready", closesSession: true },
  { code: "assistance", label: "Need Assistance", sublabel: "Anything we can help with?", closesSession: false },
];

const REQUEST_LABEL: Record<RequestCode, string> = {
  drinks: "Drinks",
  dessert: "Dessert menu",
  coffee: "Coffee",
  bill: "Bill requested",
  assistance: "Assistance",
};

/* Icons: the same inline paths the real guest screen ships. */
function ReqIcon({ code }: { code: RequestCode }) {
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (code) {
    case "drinks":
      return (
        <svg viewBox="0 0 24 24" className="dm-icon" aria-hidden="true">
          <path {...p} d="M7 3h10l-1.2 6.2a4.9 4.9 0 0 1-7.6 0Z" />
          <path {...p} d="M12 13.5V21" />
          <path {...p} d="M8.5 21h7" />
        </svg>
      );
    case "dessert":
      return (
        <svg viewBox="0 0 24 24" className="dm-icon" aria-hidden="true">
          <path {...p} d="M4 19.5h16" />
          <path {...p} d="M5.5 19.5v-6.8L18.5 8v11.5" />
          <path {...p} d="M5.5 15.9h13" />
          <circle {...p} cx="19.3" cy="5.4" r="1.1" />
        </svg>
      );
    case "coffee":
      return (
        <svg viewBox="0 0 24 24" className="dm-icon" aria-hidden="true">
          <path {...p} d="M4 9h12v5.5A4.5 4.5 0 0 1 11.5 19h-3A4.5 4.5 0 0 1 4 14.5Z" />
          <path {...p} d="M16 10.5h1.8a2.2 2.2 0 0 1 0 4.4H16" />
          <path {...p} d="M7 3.5v2M10 3.5v2M13 3.5v2" />
        </svg>
      );
    case "bill":
      return (
        <svg viewBox="0 0 24 24" className="dm-icon" aria-hidden="true">
          <path {...p} d="M6 3.5h12V21l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2Z" />
          <path {...p} d="M9 8h6M9 11.5h6M9 15h3.5" />
        </svg>
      );
    case "assistance":
      return (
        <svg viewBox="0 0 24 24" className="dm-icon" aria-hidden="true">
          <path {...p} d="M4.5 17.5a7.5 7.5 0 0 1 15 0Z" />
          <path {...p} d="M12 10V7.5" />
          <path {...p} d="M3.5 20.5h17" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Simulation state                                                    */
/* ------------------------------------------------------------------ */

type SimRequest = { code: RequestCode; atTick: number };

type SimTable = {
  id: string;
  label: string;
  zone: "Terrace" | "Inside" | "Bar";
  /** percent position on the floor plan */
  x: number;
  y: number;
  round?: boolean;
  /** negative = seated N seconds before the demo loaded; null = free */
  seatedAtTick: number | null;
  requests: SimRequest[];
  isYou?: boolean;
};

const INITIAL_TABLES: SimTable[] = [
  { id: "t1", label: "T1", zone: "Terrace", x: 10, y: 16, seatedAtTick: -48 * 60, requests: [] },
  { id: "t4", label: "T4", zone: "Terrace", x: 38, y: 14, seatedAtTick: null, requests: [] },
  { id: "t7", label: "T7", zone: "Terrace", x: 24, y: 44, round: true, seatedAtTick: -24 * 60, requests: [], isYou: true },
  { id: "t5", label: "T5", zone: "Terrace", x: 10, y: 70, seatedAtTick: null, requests: [] },
  { id: "t2", label: "T2", zone: "Inside", x: 60, y: 14, seatedAtTick: -32 * 60, requests: [] },
  { id: "t9", label: "T9", zone: "Inside", x: 84, y: 14, seatedAtTick: -24 * 60, requests: [] },
  { id: "t3", label: "T3", zone: "Inside", x: 60, y: 42, seatedAtTick: null, requests: [] },
  { id: "t6", label: "T6", zone: "Inside", x: 84, y: 42, round: true, seatedAtTick: null, requests: [] },
  { id: "b1", label: "B1", zone: "Bar", x: 46, y: 76, seatedAtTick: -11 * 60, requests: [] },
  { id: "b2", label: "B2", zone: "Bar", x: 66, y: 76, seatedAtTick: null, requests: [] },
  { id: "b3", label: "B3", zone: "Bar", x: 86, y: 76, seatedAtTick: -18 * 60, requests: [] },
];

/** The visitor's own request escalates to "overdue" after this many
 *  real seconds — a labelled time-lapse of the real 10-minute rule. */
const YOU_OVERDUE_AFTER = 45;

type Status = "free" | "good" | "waiting" | "overdue";

function tableStatus(t: SimTable, tick: number): Status {
  if (t.requests.length > 0) {
    const oldest = Math.min(...t.requests.map((r) => r.atTick));
    const age = tick - oldest;
    // Ambient tables follow the real 10-minute rule; the visitor's
    // table uses the sped-up clock so the demo shows escalation.
    const limit = t.isYou ? YOU_OVERDUE_AFTER : 10 * 60;
    return age >= limit ? "overdue" : "waiting";
  }
  return t.seatedAtTick === null ? "free" : "good";
}

function requestAge(t: SimTable, tick: number): number {
  if (t.requests.length === 0) return 0;
  return tick - Math.min(...t.requests.map((r) => r.atTick));
}

function fmtAge(seconds: number, isYou: boolean): string {
  if (isYou) {
    // The visitor's request shows live seconds — immediacy is the point.
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
  }
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

/* ------------------------------------------------------------------ */

export function DemoInteractive() {
  const [tick, setTick] = useState(0);
  const [tables, setTables] = useState<SimTable[]>(INITIAL_TABLES);
  const [guestSent, setGuestSent] = useState<Record<string, boolean>>({});
  const [showRating, setShowRating] = useState(false);
  const [ratingPhase, setRatingPhase] = useState<"asking" | "thanks">("asking");
  const [food, setFood] = useState<number | null>(null);
  const [service, setService] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const timers = useRef<number[]>([]);
  const tabletRef = useRef<HTMLDivElement | null>(null);
  const scrolledOnce = useRef(false);
  const planWrapRef = useRef<HTMLDivElement | null>(null);

  // The plan is a fixed 536×340 canvas scaled to its container, so the
  // absolutely-positioned tables keep their layout at every width.
  // (CSS can't divide lengths into a scale() number, so JS owns it.)
  useEffect(() => {
    const el = planWrapRef.current;
    if (!el) return;
    const apply = () =>
      el.style.setProperty("--dm-plan-scale", String(el.clientWidth / 536));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = timers.current;
    return () => saved.forEach((id) => window.clearTimeout(id));
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  /* ---- guest presses a request card ---- */
  const guestTap = useCallback(
    (code: RequestCode) => {
      setTables((prev) =>
        prev.map((t) =>
          t.isYou
            ? {
                ...t,
                requests: t.requests.some((r) => r.code === code)
                  ? t.requests
                  : [...t.requests, { code, atTick: tick }],
              }
            : t
        )
      );
      setGuestSent((prev) => ({ ...prev, [code]: true }));
      setFlash(`New request · Table 7 · ${REQUEST_LABEL[code]}`);
      setStep(3);
      // On stacked layouts (phone/tablet) the staff screens are below
      // the fold — the reaction would be invisible. First tap only:
      // bring the wall tablet into view so the magic actually shows.
      if (!scrolledOnce.current && window.innerWidth < 1360) {
        scrolledOnce.current = true;
        later(450, () =>
          tabletRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
        );
      }
      later(10_000, () =>
        setGuestSent((prev) => ({ ...prev, [code]: false }))
      );
      later(4_000, () => setFlash(null));
      if (code === "bill") {
        later(700, () => setShowRating(true));
      }
    },
    [tick, later]
  );

  /* ---- rating card auto-submits once both faces are chosen ---- */
  useEffect(() => {
    if (showRating && ratingPhase === "asking" && food !== null && service !== null) {
      setRatingPhase("thanks");
      later(3_500, () => {
        setShowRating(false);
        setRatingPhase("asking");
        setFood(null);
        setService(null);
      });
    }
  }, [showRating, ratingPhase, food, service, later]);

  /* ---- staff clears a table's requests ---- */
  const staffServe = useCallback((id: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, requests: [] } : t))
    );
    setOpenSheet(null);
  }, []);

  /* ---- derived ---- */
  const withStatus = useMemo(
    () =>
      tables.map((t) => ({
        table: t,
        status: tableStatus(t, tick),
        age: requestAge(t, tick),
      })),
    [tables, tick]
  );

  const stats = useMemo(() => {
    let occupied = 0, good = 0, waiting = 0, overdue = 0;
    for (const { status } of withStatus) {
      if (status !== "free") occupied += 1;
      if (status === "good") good += 1;
      if (status === "waiting") waiting += 1;
      if (status === "overdue") overdue += 1;
    }
    return { occupied, good, waiting, overdue };
  }, [withStatus]);

  const listRows = useMemo(() => {
    const rank: Record<Status, number> = { overdue: 0, waiting: 1, good: 2, free: 3 };
    return [...withStatus]
      .filter((r) => r.status !== "free")
      .sort((a, b) => {
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        if (a.status === "good" && b.status === "good") {
          return (a.table.seatedAtTick ?? 0) - (b.table.seatedAtTick ?? 0);
        }
        return b.age - a.age;
      });
  }, [withStatus]);

  const freeCount = withStatus.filter((r) => r.status === "free").length;
  const youStatus = withStatus.find((r) => r.table.isYou);

  useEffect(() => {
    if (step === 1 && (youStatus?.table.requests.length ?? 0) > 0) setStep(2);
  }, [step, youStatus]);

  const FACES = ["😖", "🙁", "😐", "🙂", "😍"];

  return (
    <div className="dm-stage">
      <div className="dm-frames">
        {/* ============ GUEST PHONE ============ */}
        <figure className="dm-slot dm-slot-guest">
          <div className="dm-step" data-active={step === 1}>
            <b>1</b> You&apos;re the guest — tap a request below
          </div>
          <div className="dm-phone">
            <div className="dm-guest">
              <div className="dm-guest-hero">
                <p className="dm-guest-venue">BELLA VISTA</p>
                <span className="dm-guest-venuesub">RESTAURANT · TERRACE</span>
                <div className="dm-guest-welcome">
                  <p className="dm-guest-hello">Good evening,</p>
                  <p className="dm-guest-table">Table 7</p>
                </div>
              </div>

              <div className="dm-guest-body">
                {showRating ? (
                  <div className="dm-rating">
                    {ratingPhase === "thanks" ? (
                      <p className="dm-rating-thanks">Thank you — enjoy the rest of your evening.</p>
                    ) : (
                      <>
                        <p className="dm-rating-title">Before you go — how was it?</p>
                        {[
                          { label: "The food", value: food, set: setFood },
                          { label: "The service", value: service, set: setService },
                        ].map((row) => (
                          <div className="dm-rating-row" key={row.label}>
                            <span>{row.label}</span>
                            <div className="dm-rating-faces">
                              {FACES.map((face, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  data-active={row.value === i + 1}
                                  onClick={() => row.set(i + 1)}
                                >
                                  {face}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="dm-rating-skip"
                          onClick={() => setShowRating(false)}
                        >
                          Skip
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="dm-guest-divider"><span>HOW CAN WE HELP?</span></div>
                    <div className="dm-guest-grid">
                      {REQUEST_TYPES.map((rt) => {
                        const sent = guestSent[rt.code];
                        return (
                          <button
                            key={rt.code}
                            type="button"
                            className="dm-guest-card"
                            data-sent={sent ? "true" : "false"}
                            onClick={() => guestTap(rt.code)}
                          >
                            <span className="dm-guest-ic"><ReqIcon code={rt.code} /></span>
                            <span className="dm-guest-tx">
                              <span className="dm-guest-lb">{rt.label}</span>
                              <span className="dm-guest-sb">
                                {sent ? "Done — we heard you ✓" : rt.sublabel}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="dm-guest-note">
                      No app. No sign-up. The guest just tapped the tag on the table.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <figcaption>
            <b>The guest&apos;s phone</b> — what a customer sees the moment they
            tap the NFC tag (or scan the QR) on their table.
          </figcaption>
        </figure>

        {/* ============ STAFF TABLET (floor plan) ============ */}
        <figure className="dm-slot dm-slot-tablet">
          <div className="dm-step" data-active={step === 2}>
            <b>2</b> Watch it land on both staff screens, instantly
          </div>
          <div className="dm-tablet" ref={tabletRef}>
            <div className="dm-staff-top">
              <span className="dm-staff-brand">mytable<em>view</em></span>
              <span className="dm-staff-venue">Bella Vista · Live floor</span>
              <div className="dm-staff-stats">
                <span><b>{stats.occupied}</b> occupied</span>
                <span className="ok"><b>{stats.good}</b> all good</span>
                <span className="warn"><b>{stats.waiting}</b> waiting</span>
                <span className="bad"><b>{stats.overdue}</b> over 10 min</span>
              </div>
            </div>

            {flash ? <div className="dm-ticker">{flash}</div> : null}

            <div className="dm-plan-wrap" ref={planWrapRef}>
            <div className="dm-plan">
              <span className="dm-zone-tag" style={{ left: "4%", top: "4%" }}>Terrace</span>
              <span className="dm-zone-tag" style={{ left: "56%", top: "4%" }}>Inside</span>
              <span className="dm-zone-tag" style={{ left: "42%", top: "66%" }}>Bar</span>

              {withStatus.map(({ table, status, age }) => (
                <button
                  key={table.id}
                  type="button"
                  className="dm-table"
                  data-status={status}
                  data-round={table.round ? "true" : "false"}
                  data-you={table.isYou ? "true" : "false"}
                  style={{ left: `${table.x}%`, top: `${table.y}%` }}
                  onClick={() =>
                    table.requests.length > 0
                      ? setOpenSheet(openSheet === table.id ? null : table.id)
                      : undefined
                  }
                >
                  <span className="dm-table-label">{table.label}</span>
                  {table.requests.length > 0 ? (
                    <span className="dm-table-age">{fmtAge(age, !!table.isYou)}</span>
                  ) : null}
                  {table.isYou ? <span className="dm-you-tag">YOU</span> : null}
                  {openSheet === table.id && table.requests.length > 0 ? (
                    <span className="dm-sheet">
                      <span className="dm-sheet-what">
                        {table.requests.map((r) => REQUEST_LABEL[r.code]).join(" · ")}
                      </span>
                      <span
                        role="button"
                        className="dm-sheet-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          staffServe(table.id);
                        }}
                      >
                        Mark served ✓
                      </span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            </div>
            <p className="dm-plan-note">
              Amber = waiting · red = over 10 minutes. Your request turns red
              after {YOU_OVERDUE_AFTER}s here — a time-lapse of the real 10-minute rule.
            </p>
          </div>
          <figcaption>
            <b>The wall tablet</b> — every table at a glance for the whole team.
            Tap a glowing table to serve it.
          </figcaption>
        </figure>

        {/* ============ WAITER PHONE (list) ============ */}
        <figure className="dm-slot dm-slot-waiter">
          <div className="dm-step" data-active={step === 3}>
            <b>3</b> Now be the waiter — tap the table, mark it served
          </div>
          <div className="dm-phone dm-phone-staff">
            <div className="dm-staff-screen">
            <div className="dm-staff-chrome">
              <span className="dm-staff-brand">mytable<em>view</em></span>
              <span className="dm-staff-pill">Bella Vista</span>
            </div>
            <div className="dm-list">
              {listRows.map(({ table, status, age }) => (
                <button
                  key={table.id}
                  type="button"
                  className="dm-row"
                  data-status={status}
                  onClick={() =>
                    table.requests.length > 0
                      ? staffServe(table.id)
                      : undefined
                  }
                >
                  <span className="dm-row-no">{table.label}</span>
                  <span className="dm-row-meta">
                    <span className="dm-row-zone">{table.zone}</span>
                    <span className="dm-row-what">
                      {table.requests.length > 0
                        ? table.requests.map((r) => REQUEST_LABEL[r.code]).join(" · ")
                        : "No open requests"}
                    </span>
                  </span>
                  <span className="dm-row-time">
                    {table.requests.length > 0 ? (
                      <>
                        <b>{fmtAge(age, !!table.isYou)}</b>
                        <span>{table.requests.length > 0 ? "tap = served" : ""}</span>
                      </>
                    ) : (
                      <>
                        <b>{Math.round((tick - (table.seatedAtTick ?? 0)) / 60)} min</b>
                        <span>at table</span>
                      </>
                    )}
                  </span>
                </button>
              ))}
              <div className="dm-free">Free tables · {freeCount}</div>
            </div>
            </div>
          </div>
          <figcaption>
            <b>The waiter&apos;s pocket</b> — the same floor as a list, longest
            wait always on top. Tap a row to mark it served.
          </figcaption>
        </figure>
      </div>

      <p className="dm-honesty">
        One deliberate detail: the guest never sees &quot;seen by staff&quot;
        ticks — a guest watching a status is a guest counting the seconds.
        They get a quiet &quot;we heard you&quot;, staff get the timer. And when
        the bill is requested, the two-question rating catches an unhappy
        guest <em>before</em> they take it to Google.
      </p>
    </div>
  );
}
