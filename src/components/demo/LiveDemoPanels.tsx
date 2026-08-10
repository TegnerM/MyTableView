"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * The live demo panels — the reference designs, replicated and ALIVE.
 * Guest phone (light) → overview screen (dark) → staff phone (dark),
 * exactly like the approved reference images, with every moving part
 * belonging to the visitor's own table/room. Tap on the guest phone →
 * it appears on the overview and the staff phone the same instant;
 * the staff button answers back on the guest's chip.
 *
 * Ambient rows (other tables/rooms) are static scenery from the
 * reference designs — numbers never collide with the visitor's own.
 */

type LiveItem = {
  id: number;
  label: string;
  detail: string | null;
  col: "restaurant" | "bar" | "rooms";
  todo: string | null;
  createdAt: number;
};

function useTicker(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function elapsed(now: number, createdAt: number): string {
  const total = Math.max(0, Math.floor((now - createdAt) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function useLive() {
  const [open, setOpen] = useState<LiveItem[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [lastDone, setLastDone] = useState<LiveItem | null>(null);
  const nextId = useRef(1);

  const add = (
    label: string,
    detail: string | null,
    col: LiveItem["col"],
    todo: string | null
  ) =>
    setOpen((prev) => [
      {
        id: nextId.current++,
        label,
        detail,
        col,
        todo,
        createdAt: Date.now(),
      },
      ...prev,
    ]);

  const completeNewest = () =>
    setOpen((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      setLastDone(first);
      setDoneCount((count) => count + 1);
      return rest;
    });

  return { open, doneCount, lastDone, add, completeNewest };
}

/* ================================================================ */
/* Restaurant — reference: dark Main Dining Room floor + My Requests */
/* ================================================================ */

const REST_ACTIONS = [
  { icon: "🗒", label: "Menu", sub: "Browse and order food and drinks", detail: "2× Lemonade · 1× Club sandwich" },
  { icon: "🔔", label: "Need assistance", sub: "Get help from our staff", detail: null },
  { icon: "🧾", label: "Ask for bill", sub: "We'll bring the bill to you.", detail: null },
];

export function RestaurantLivePanels({ photo }: { photo: string }) {
  const now = useTicker();
  const { open, doneCount, lastDone, add, completeNewest } = useLive();
  const newest = open[0] ?? null;

  return (
    <div className="dl-visuals">
      <div className="dl-shot">
        <Image src={photo} alt="" fill sizes="(max-width: 1120px) 90vw, 22rem" />
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Guest phone — Table 7 */}
      <div className="dl-gphone">
        <div className="dl-status"><span>9:41</span><span>▄▆█ ᯤ ▐▋</span></div>
        <div className="dl-ghead">My<em>Table</em>View</div>
        <div className="dl-groom">Table 7</div>
        <div className="dl-gsub">How can we help you?</div>
        {REST_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="dl-gact"
            onClick={() => add(action.label, action.detail, "restaurant", null)}
          >
            <i>{action.icon}</i>
            <span>
              <b>{action.label}</b>
              <span>{action.sub}</span>
            </span>
          </button>
        ))}
        <div className="dl-gphoto">
          <Image src="/landing/card-restaurant.jpg" alt="" fill sizes="226px" />
          <div className="dl-gchip">
            {newest ? (
              <span>Your request: <b>Received ✓</b></span>
            ) : lastDone ? (
              <span>{lastDone.label}: <b className="dl-ok">Done ✓</b></span>
            ) : (
              <span>Tap anything — staff see it instantly</span>
            )}
          </div>
        </div>
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Main Dining Room — dark floor */}
      <div className="dl-tab-dark">
        <div className="dl-tab-top"><i>☰</i><span>Main Dining Room</span><i>⏳</i></div>
        <div className="dl-floor">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="dl-rtbl">{n}</div>
          ))}
          <div className={newest ? "dl-rtbl dl-rtbl-hot" : "dl-rtbl"}>
            7
            {newest ? (
              <span className="dl-rtbl-timer">{elapsed(now, newest.createdAt)}</span>
            ) : null}
          </div>
          {[8, 9, 10, 11].map((n) => (
            <div key={n} className="dl-rtbl">{n}</div>
          ))}
          <div className="dl-rtbl dl-rtbl-late">12</div>
        </div>
        <div className="dl-legend">
          <span className="dl-leg-ok">● OK</span>
          <span className="dl-leg-warn">● 5+ min</span>
          <span className="dl-leg-late">● 10+ min</span>
        </div>
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* My Requests — dark staff phone */}
      <div className="dl-sphone">
        <div className="dl-status"><span>9:41</span><span>▄▆█ ᯤ ▐▋</span></div>
        <div className="dl-shead"><i>☰</i><span>My Requests</span><i>⋮</i></div>
        <div className="dl-stabs">
          <span className="dl-on">Active ({open.length + 1})</span>
          <span>Done{doneCount > 0 ? ` (${doneCount})` : ""}</span>
        </div>
        {newest ? (
          <>
            <div className="dl-scard-dark dl-scard-dark-hot">
              <b>TABLE 7</b> 🔔
              <div className="dl-sname">{newest.label}</div>
              {newest.detail ? <div>{newest.detail}</div> : null}
              <div>🕐 <span className="dl-stime">{elapsed(now, newest.createdAt)}</span></div>
            </div>
            <button type="button" className="dl-sbtn dl-sbtn-dark" style={{ width: "calc(100% - 1.1rem)", margin: "0.2rem 0.55rem 0" }} onClick={completeNewest}>
              ✓ Mark as served
            </button>
            <button type="button" className="dl-sbtn dl-sbtn-dark" style={{ width: "calc(100% - 1.1rem)", margin: "0.4rem 0.55rem 0.2rem" }}>
              View table
            </button>
          </>
        ) : (
          <div className="dl-scard-dark">
            <b>Your table is nr 7</b>
            <div>Tap a button on the guest phone →</div>
          </div>
        )}
        {/* Table 12 is overdue on the floor — it MUST be here too. */}
        <div className="dl-scard-dark">
          <b>TABLE 12</b>
          <div className="dl-sname">Ask for bill</div>
          <div>🕐 <span className="dl-stime dl-stime-late">10:12</span></div>
        </div>
        <div className="dl-snav">
          <span className="dl-on">
            <i>📥</i>Requests
            <span className="dl-badge">{open.length + 1}</span>
          </span>
          <span><i>🍽</i>Tables</span>
          <span><i>💬</i>Messages</span>
          <span><i>⋯</i>More</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* Bar — reference: dark Bar Overview + Table 5 order screen         */
/* ================================================================ */

const BAR_ACTIONS = [
  { icon: "🍸", label: "Menu", sub: "Browse and order drinks and bar bites", detail: "2 × Mojito · 1 × Gin & Tonic" },
  { icon: "🔔", label: "Need assistance", sub: "Get help from our staff", detail: null },
  { icon: "🧾", label: "Ask for bill", sub: "We'll bring the bill to you.", detail: null },
];

export function BarLivePanels({ photo }: { photo: string }) {
  const now = useTicker();
  const { open, doneCount, lastDone, add, completeNewest } = useLive();
  const newest = open[0] ?? null;

  return (
    <div className="dl-visuals">
      <div className="dl-shot">
        <Image src={photo} alt="" fill sizes="(max-width: 1120px) 90vw, 22rem" />
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Guest phone — Table 5 */}
      <div className="dl-gphone">
        <div className="dl-status"><span>9:41</span><span>▄▆█ ᯤ ▐▋</span></div>
        <div className="dl-ghead">Sunset Bar</div>
        <div className="dl-groom">Table 5</div>
        <div className="dl-gsub">How can we help you?</div>
        {BAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="dl-gact"
            onClick={() => add(action.label === "Menu" ? "Order drinks" : action.label, action.detail, "bar", null)}
          >
            <i>{action.icon}</i>
            <span>
              <b>{action.label}</b>
              <span>{action.sub}</span>
            </span>
          </button>
        ))}
        <div className="dl-gphoto">
          <Image src="/landing/card-bar.jpg" alt="" fill sizes="226px" style={{ objectPosition: "50% 62%" }} />
          <div className="dl-gchip">
            {newest ? (
              <span>Your order: <b>Being prepared</b></span>
            ) : lastDone ? (
              <span>{lastDone.label}: <b className="dl-ok">Served ✓</b></span>
            ) : (
              <span>Tap anything — the bar sees it instantly</span>
            )}
          </div>
        </div>
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Bar Overview — dark */}
      <div className="dl-tab-dark">
        <div className="dl-tab-top"><i>☰</i><span>Bar Overview</span><i>⏳</i></div>
        <div className="dl-btabs">
          <span className="dl-on">Active ({open.length + 3})</span>
          <span>Completed ({8 + doneCount})</span>
        </div>
        <div className="dl-bargrid">
          {open.map((item) => (
            <div key={item.id} className="dl-bcard dl-bcard-hot">
              <b>TABLE 5</b>
              {item.label}
              <div><span className="dl-btime">{elapsed(now, item.createdAt)}</span></div>
              {item.detail ? <div>· {item.detail}</div> : null}
            </div>
          ))}
          <div className="dl-bcard">
            <b>TABLE 2</b>
            Order drinks
            <div><span className="dl-btime">1:18</span></div>
            <div>· 2 × Aperol Spritz</div>
          </div>
          <div className="dl-bcard">
            <b>TABLE 8</b>
            Order drinks
            <div><span className="dl-btime">2:45</span></div>
            <div>· 1 × Margarita</div>
          </div>
          <div className="dl-bcard">
            <b>TABLE 1</b>
            Order drinks
            <div><span className="dl-btime dl-btime-late">4:09</span></div>
            <div>· 1 × Rum & Coke</div>
          </div>
        </div>
        <div className="dl-tab-foot">Last updated: Just now</div>
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Table 5 — dark bartender phone */}
      <div className="dl-sphone">
        <div className="dl-status"><span>9:41</span><span>▄▆█ ᯤ ▐▋</span></div>
        <div className="dl-shead"><i>☰</i><span>Open orders ({open.length + 3})</span><i>⋮</i></div>
        {newest ? (
          <>
            <div style={{ padding: "0.3rem 0.7rem 0" }}>
              <div className="dl-sname" style={{ fontSize: "0.78rem" }}>Table 5 — {newest.label}</div>
              <div className="dl-stime">{elapsed(now, newest.createdAt)}</div>
            </div>
            <div className="dl-scard-dark" style={{ marginTop: "0.4rem" }}>
              <b>Items requested</b>
              {newest.detail ? (
                newest.detail.split("·").map((line) => <div key={line}>· {line.trim()}</div>)
              ) : (
                <div>· {newest.label}</div>
              )}
            </div>
            <button type="button" className="dl-sbtn dl-sbtn-orange" style={{ width: "calc(100% - 1.1rem)", margin: "0.2rem 0.55rem 0" }} onClick={completeNewest}>
              ✓ Mark as served
            </button>
          </>
        ) : (
          <div className="dl-scard-dark" style={{ marginTop: "0.4rem" }}>
            <b>No open orders from Table 5</b>
            <div>Order on the guest phone →</div>
          </div>
        )}
        {/* The same orders the Bar Overview shows — always in sync. */}
        <div className="dl-upnext">UP NEXT</div>
        <div className="dl-scard-dark">
          <b>TABLE 2</b>
          <div className="dl-sname">Order drinks</div>
          <div>2 × Aperol Spritz · <span className="dl-stime">1:18</span></div>
        </div>
        <div className="dl-scard-dark">
          <b>TABLE 8</b>
          <div className="dl-sname">Order drinks</div>
          <div>1 × Margarita · <span className="dl-stime">2:45</span></div>
        </div>
        <div className="dl-scard-dark">
          <b>TABLE 1</b>
          <div className="dl-sname">Order drinks</div>
          <div>1 × Rum &amp; Coke · <span className="dl-stime dl-stime-late">4:09</span></div>
        </div>
        <div className="dl-snav">
          <span className="dl-on"><i>🍸</i>Overview</span>
          <span><i>📥</i>Orders</span>
          <span><i>🕐</i>History</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* Hotel — reference: light guest phone, Hotel Overview, Open Requests */
/* ================================================================ */

const HOTEL_ACTIONS: {
  icon: string;
  label: string;
  sub: string;
  detail: string | null;
  col: LiveItem["col"];
  todo: string;
}[] = [
  { icon: "🛎", label: "Room Service", sub: "Order food and drinks", detail: "Club sandwich", col: "rooms", todo: "Bring the room-service order to the room." },
  { icon: "🧺", label: "Fresh Towels", sub: "We'll bring new towels", detail: null, col: "rooms", todo: "Deliver 2 fresh towels to the room." },
  { icon: "🔔", label: "Need Assistance", sub: "Get help from our team", detail: null, col: "rooms", todo: "Call or visit the room to help." },
  { icon: "📅", label: "Dinner Reservation", sub: "Reserve a table at our restaurant", detail: "Tonight · 2 guests", col: "restaurant", todo: "Confirm a table for tonight, 2 guests." },
];

export function HotelLivePanels({ photo }: { photo: string }) {
  const now = useTicker();
  const { open, lastDone, add, completeNewest } = useLive();
  const newest = open[0] ?? null;
  const roomsOpen = open.filter((item) => item.col === "rooms");
  const restOpen = open.filter((item) => item.col === "restaurant");

  return (
    <div className="dl-visuals">
      <div className="dl-shot">
        <Image src={photo} alt="" fill sizes="(max-width: 1120px) 90vw, 22rem" />
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Guest phone — Room 307, light with bottom nav */}
      <div className="dl-gphone">
        <div className="dl-status"><span>9:41</span><span>▄▆█ ᯤ ▐▋</span></div>
        <div className="dl-ghead"><em>♛</em> Grand View Hotel</div>
        <div className="dl-groom">Room 307</div>
        <div className="dl-gsub">How can we help you?</div>
        {HOTEL_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="dl-gact"
            onClick={() => add(action.label, action.detail, action.col, action.todo)}
          >
            <i>{action.icon}</i>
            <span>
              <b>{action.label}</b>
              <span>{action.sub}</span>
            </span>
          </button>
        ))}
        <div className="dl-gchip-inline">
          {newest ? (
            <span>Your request: <b>Received ✓</b></span>
          ) : lastDone ? (
            <span>{lastDone.label}: <b className="dl-ok">Completed ✓</b></span>
          ) : (
            <span>Tap anything — staff see it instantly</span>
          )}
        </div>
        <div className="dl-gnav">
          <span className="dl-on"><i>⌂</i>Home</span>
          <span><i>🍽</i>Orders</span>
          <span><i>📅</i>Reservations</span>
          <span><i>⋯</i>More</span>
        </div>
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Hotel Overview — dark sidebar + light main */}
      <div className="dl-tab-hotel">
        <div className="dl-hside">
          <div className="dl-burger">☰</div>
          <div className="dl-hitem dl-hitem-on"><i>⌂</i>Overview</div>
          <div className="dl-hitem"><i>🍽</i>Restaurant</div>
          <div className="dl-hitem"><i>🍸</i>Bar</div>
          <div className="dl-hitem"><i>🛏</i>Rooms</div>
          <div className="dl-hitem"><i>👥</i>Staff</div>
          <div className="dl-hitem"><i>📊</i>Reports</div>
          <div className="dl-hitem"><i>⚙</i>Settings</div>
        </div>
        <div className="dl-hmain">
          <div className="dl-htop">
            <b>Hotel Overview</b>
            <span className="dl-hfloors">All floors ▾</span>
          </div>
          <div className="dl-hcols">
            <div className="dl-hcol dl-hcol-rest">
              <div className="dl-hcol-h"><i>🍴</i> RESTAURANT</div>
              <div className="dl-hcol-sub">Open Requests ({2 + restOpen.length})</div>
              {restOpen.map((item) => (
                <div key={item.id} className="dl-hcard dl-hcard-hot">
                  <span className="dl-bell">🔔</span>
                  <b>Room 307</b>
                  {item.label}
                  <br />
                  {elapsed(now, item.createdAt)}
                </div>
              ))}
              <div className="dl-hcard">
                <span className="dl-bell">🔔</span>
                <b>Table 12</b>
                Dinner reservation
                <br />
                19:30 · 2 guests
                <br />
                2 min ago
              </div>
              <div className="dl-hcard">
                <b>Table 7</b>
                Dinner reservation
                <br />
                20:15 · 4 guests
                <br />
                5 min ago
              </div>
              <div className="dl-viewall">View all ›</div>
            </div>
            <div className="dl-hcol dl-hcol-bar">
              <div className="dl-hcol-h"><i>🍸</i> BAR</div>
              <div className="dl-hcol-sub">Open Requests (1)</div>
              <div className="dl-hcard">
                <b>Table 5</b>
                Order drinks
                <br />
                2 Mojito · 1 Gin &amp; Tonic
                <br />
                1 min ago
              </div>
              <div className="dl-viewall">View all ›</div>
            </div>
            <div className="dl-hcol dl-hcol-rooms">
              <div className="dl-hcol-h"><i>🛏</i> ROOMS</div>
              <div className="dl-hcol-sub">Open Requests ({2 + roomsOpen.length})</div>
              {roomsOpen.map((item) => (
                <div key={item.id} className="dl-hcard dl-hcard-hot">
                  <span className="dl-bell">🔔</span>
                  <b>307</b>
                  {item.label}
                  <br />
                  {elapsed(now, item.createdAt)}
                </div>
              ))}
              <div className="dl-hcard">
                <b>205</b>
                Room service
                <br />
                Club sandwich
                <br />
                6 min ago
              </div>
              <div className="dl-hcard">
                <b>102</b>
                Need assistance
                <br />
                8 min ago
              </div>
              <div className="dl-viewall">View all ›</div>
            </div>
          </div>
        </div>
      </div>
      <div className="dl-arrow" aria-hidden="true">▸▸</div>

      {/* Open Requests — dark staff phone */}
      <div className="dl-sphone">
        <div className="dl-status"><span>9:41</span><span>▄▆█ ᯤ ▐▋</span></div>
        <div className="dl-shead"><i>☰</i><span>Open Requests</span><i>⏳</i></div>
        <div className="dl-stabs">
          <span className="dl-on">All ({5 + open.length})</span>
          <span>Rooms ({2 + roomsOpen.length})</span>
          <span>Restaurant ({2 + restOpen.length})</span>
          <span>Bar (1)</span>
        </div>
        <div className="dl-snewest">NEWEST</div>
        {newest ? (
          <div className="dl-scard">
            <div className="dl-scard-top">
              <b>Room 307</b>
              <span className="dl-chip">{newest.col === "restaurant" ? "RESTAURANT" : "ROOMS"}</span>
            </div>
            <div className="dl-sname">{newest.label}</div>
            <div className="dl-srow">
              <span>{elapsed(now, newest.createdAt)}</span>
              <span className="dl-hp">High Priority</span>
            </div>
            <div className="dl-swhat">
              <b>What to do:</b>
              <br />
              {newest.todo}
            </div>
            <button type="button" className="dl-sbtn" onClick={completeNewest}>
              Mark as completed
            </button>
          </div>
        ) : (
          <div className="dl-scard-dark">
            <b>All caught up</b>
            <div>Tap a button on the guest phone →</div>
          </div>
        )}
        <div className="dl-scard-dark">
          <div className="dl-scard-top"><b>Room 205</b><span className="dl-chip">ROOMS</span></div>
          <div className="dl-sname">Room service</div>
          <div className="dl-srow"><span>Club sandwich · 6 min ago</span></div>
        </div>
        <div className="dl-scard-dark">
          <div className="dl-scard-top"><b>Room 102</b><span className="dl-chip">ROOMS</span></div>
          <div className="dl-sname">Need assistance</div>
          <div className="dl-srow"><span>8 min ago</span></div>
        </div>
        <div className="dl-snav">
          <span className="dl-on">
            <i>📥</i>Requests
            <span className="dl-badge">{5 + open.length}</span>
          </span>
          <span><i>🛏</i>Rooms</span>
          <span><i>💬</i>Messages</span>
          <span><i>⋯</i>More</span>
        </div>
      </div>
    </div>
  );
}
