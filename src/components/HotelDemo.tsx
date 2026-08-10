"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hotel demo — /demo/hotel.
 *
 * The visitor plays the guest in Room 412 AND the hotel staff at
 * once: ask for towels, report the AC with a note, order breakfast —
 * and watch each tap land on the floor panel and the room-service
 * kitchen the same instant. Staff buttons answer back: "On it" turns
 * the guest's chip to In progress; Ready → Delivered walks the order
 * through the same states the real boards use.
 *
 * Entirely client-simulated like the other demos: no venue, no rows,
 * no cleanup. Visuals mirror the real hotel surface (light navy).
 */

type ReqState = "open" | "acknowledged" | "done";
type TicketState = "new" | "preparing" | "ready" | "delivered";

type SimRequest = {
  id: number;
  room: string;
  label: string;
  note: string | null;
  state: ReqState;
  createdAtTick: number;
};

type SimTicket = {
  id: number;
  room: string;
  items: { name: string; qty: number }[];
  state: TicketState;
  createdAtTick: number;
};

type Screen = "home" | "housekeeping" | "maintenance" | "menu" | "sent";

const HK_OPTIONS = [
  { label: "Fresh towels", sub: "" },
  { label: "Make up my room", sub: "We'll come while you're out" },
  { label: "Extra pillows & blanket", sub: "" },
  { label: "Amenities refill", sub: "Soap, shampoo, coffee & tea" },
];

const MENU = [
  { id: "breakfast", name: "Continental breakfast", detail: "Pastries, fruit, juice, coffee", price: 18 },
  { id: "juice", name: "Fresh orange juice", detail: "Squeezed to order", price: 6 },
  { id: "club", name: "Club sandwich", detail: "Fries, aioli", price: 14 },
];

function money(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

function elapsed(fromTick: number, nowTick: number): string {
  const seconds = Math.max(0, nowTick - fromTick);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function HotelDemo() {
  const [tick, setTick] = useState(0);
  const [screen, setScreen] = useState<Screen>("home");
  const [sentWhat, setSentWhat] = useState("");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [requests, setRequests] = useState<SimRequest[]>([]);
  const [tickets, setTickets] = useState<SimTicket[]>([]);
  const nextId = useRef(1);
  const ambientFired = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* An ambient request from another room keeps the floor alive even
     before the visitor's first tap — clearly not theirs (Room 208). */
  useEffect(() => {
    if (tick >= 5 && !ambientFired.current) {
      ambientFired.current = true;
      setRequests((prev) => [
        ...prev,
        {
          id: nextId.current++,
          room: "Room 208",
          label: "Extra pillows & blanket",
          note: null,
          state: "open",
          createdAtTick: tick,
        },
      ]);
    }
  }, [tick]);

  const addRequest = (label: string, withNote?: string) => {
    setRequests((prev) => [
      ...prev,
      {
        id: nextId.current++,
        room: "Room 412",
        label,
        note: withNote && withNote.trim() ? withNote.trim() : null,
        state: "open",
        createdAtTick: tick,
      },
    ]);
    setSentWhat(label);
    setScreen("sent");
  };

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = MENU.reduce(
    (sum, item) => sum + (cart[item.id] ?? 0) * item.price,
    0
  );

  const sendOrder = () => {
    if (cartCount === 0) return;
    setTickets((prev) => [
      ...prev,
      {
        id: nextId.current++,
        room: "Room 412",
        items: MENU.filter((item) => cart[item.id]).map((item) => ({
          name: item.name,
          qty: cart[item.id],
        })),
        state: "new",
        createdAtTick: tick,
      },
    ]);
    setCart({});
    setSentWhat("Room service");
    setScreen("sent");
  };

  const actRequest = (id: number) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === id
          ? {
              ...request,
              state: request.state === "open" ? "acknowledged" : "done",
            }
          : request
      )
    );
  };

  const actTicket = (id: number) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === id
          ? {
              ...ticket,
              state:
                ticket.state === "new"
                  ? "preparing"
                  : ticket.state === "preparing"
                    ? "ready"
                    : "delivered",
            }
          : ticket
      )
    );
  };

  /* The guest chip: the visitor's own order first, else their own
     open request. Facts only, like the real surface. */
  const myTicket = tickets.find(
    (ticket) => ticket.room === "Room 412" && ticket.state !== "delivered"
  );
  const myRequest = [...requests]
    .reverse()
    .find((request) => request.room === "Room 412" && request.state !== "done");
  const chip = myTicket
    ? {
        label: "Your order:",
        state:
          myTicket.state === "new"
            ? "Received"
            : myTicket.state === "preparing"
              ? "Preparing"
              : "On the way",
      }
    : myRequest
      ? {
          label: "Your request:",
          state: myRequest.state === "acknowledged" ? "In progress" : "Received",
        }
      : null;

  const openRequests = requests.filter((request) => request.state !== "done");
  const liveTickets = tickets.filter((ticket) => ticket.state !== "delivered");

  return (
    <div className="hd-panes">
      {/* ---------------------------------------------- guest phone */}
      <div className="hd-phone">
        {screen === "home" ? (
          <>
            <div className="hd-ph-head">
              <p className="hd-ph-brand">
                Ⓜ my<em>table</em>view <b>Hotel</b>
              </p>
              <p className="hd-ph-name">Grand Meridian</p>
              <p className="hd-ph-room">
                <strong>Room 412</strong> · Floor 4
              </p>
            </div>
            <div className="hd-ph-body">
              <button
                type="button"
                className="hd-act hd-act-feature"
                onClick={() => setScreen("menu")}
              >
                <span className="hd-ic" aria-hidden="true">🍽️</span>
                <span className="hd-tx">
                  <b>Room service</b>
                  <i>Breakfast, dinner &amp; drinks to your door</i>
                </span>
                <span className="hd-ch" aria-hidden="true">›</span>
              </button>
              <button
                type="button"
                className="hd-act"
                onClick={() => setScreen("housekeeping")}
              >
                <span className="hd-ic" aria-hidden="true">🛏️</span>
                <span className="hd-tx">
                  <b>Housekeeping</b>
                  <i>Towels, make up room, pillows</i>
                </span>
                <span className="hd-ch" aria-hidden="true">›</span>
              </button>
              <div className="hd-grid2">
                <button
                  type="button"
                  className="hd-act"
                  onClick={() => setScreen("maintenance")}
                >
                  <span className="hd-ic" aria-hidden="true">🔧</span>
                  <span className="hd-tx">
                    <b>Maintenance</b>
                    <i>Something not working</i>
                  </span>
                </button>
                <button
                  type="button"
                  className="hd-act"
                  onClick={() => addRequest("Concierge")}
                >
                  <span className="hd-ic" aria-hidden="true">🛎️</span>
                  <span className="hd-tx">
                    <b>Concierge</b>
                    <i>We&apos;re at your service</i>
                  </span>
                </button>
              </div>
              {chip ? (
                <p className="hd-chip">
                  <span className="hd-dot" aria-hidden="true" />
                  {chip.label} <b>{chip.state}</b>
                </p>
              ) : (
                <p className="hd-hint">Tap anything — staff see it instantly →</p>
              )}
            </div>
          </>
        ) : null}

        {screen === "housekeeping" ? (
          <div className="hd-sheet">
            <div className="hd-sheet-head">
              <button type="button" className="hd-back" onClick={() => setScreen("home")}>
                ‹
              </button>
              <span>
                <b>Housekeeping</b>
                <i>What can we bring or do?</i>
              </span>
            </div>
            {HK_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                className="hd-opt"
                onClick={() => addRequest(option.label)}
              >
                <b>{option.label}</b>
                {option.sub ? <i>{option.sub}</i> : null}
              </button>
            ))}
          </div>
        ) : null}

        {screen === "maintenance" ? (
          <div className="hd-sheet">
            <div className="hd-sheet-head">
              <button type="button" className="hd-back" onClick={() => setScreen("home")}>
                ‹
              </button>
              <span>
                <b>Maintenance</b>
                <i>Tell us what&apos;s wrong and we&apos;ll fix it</i>
              </span>
            </div>
            <textarea
              className="hd-note"
              rows={3}
              maxLength={140}
              placeholder="e.g. the AC isn't cooling…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button
              type="button"
              className="hd-cta"
              onClick={() => {
                addRequest("Maintenance", note || "The AC isn't cooling");
                setNote("");
              }}
            >
              Send to maintenance
            </button>
          </div>
        ) : null}

        {screen === "menu" ? (
          <div className="hd-sheet">
            <div className="hd-sheet-head">
              <button type="button" className="hd-back" onClick={() => setScreen("home")}>
                ‹
              </button>
              <span>
                <b>Room service</b>
                <i>Room 412 · charged to your room</i>
              </span>
            </div>
            {MENU.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hd-dish"
                onClick={() =>
                  setCart((prev) => ({
                    ...prev,
                    [item.id]: Math.min(9, (prev[item.id] ?? 0) + 1),
                  }))
                }
              >
                <span className="hd-dish-tx">
                  <b>{item.name}</b>
                  <i>{item.detail}</i>
                </span>
                <span className="hd-dish-price">{money(item.price)}</span>
                <span className="hd-dish-add">
                  {cart[item.id] ? `${cart[item.id]}×` : "+"}
                </span>
              </button>
            ))}
            {cartCount > 0 ? (
              <button type="button" className="hd-cta" onClick={sendOrder}>
                Send to Room 412 · {money(cartTotal)}
              </button>
            ) : null}
          </div>
        ) : null}

        {screen === "sent" ? (
          <div className="hd-sent">
            <span className="hd-sent-ok" aria-hidden="true">✓</span>
            <h3>Sent!</h3>
            <p>
              {sentWhat} is on the staff screens — look right. Watch them
            answer.
            </p>
            <button
              type="button"
              className="hd-cta"
              onClick={() => setScreen("home")}
            >
              Back to Room 412
            </button>
          </div>
        ) : null}
      </div>

      {/* ---------------------------------------------- staff panels */}
      <div className="hd-staff">
        <section className="hd-board">
          <h3>Floor — live requests</h3>
          {openRequests.length === 0 ? (
            <p className="hd-empty">All quiet. Ask for something on the phone.</p>
          ) : (
            openRequests.map((request) => (
              <div
                key={request.id}
                className="hd-req"
                data-state={request.state}
                data-note={request.note ? "true" : "false"}
              >
                <span className="hd-req-tx">
                  <b>{request.room}</b>
                  <i>
                    {request.label}
                    {request.note ? ` — “${request.note}”` : ""}
                  </i>
                </span>
                <span className="hd-req-when">
                  {elapsed(request.createdAtTick, tick)}
                </span>
                <button
                  type="button"
                  className="hd-req-btn"
                  onClick={() => actRequest(request.id)}
                >
                  {request.state === "open" ? "On it" : "Done"}
                </button>
              </div>
            ))
          )}
        </section>

        <section className="hd-board">
          <h3>Kitchen — room service</h3>
          {liveTickets.length === 0 ? (
            <p className="hd-empty">
              No orders yet. Order breakfast on the phone.
            </p>
          ) : (
            liveTickets.map((ticket) => (
              <div key={ticket.id} className="hd-ticket" data-state={ticket.state}>
                <span className="hd-ticket-state">
                  {ticket.state === "new"
                    ? "New"
                    : ticket.state === "preparing"
                      ? "Preparing"
                      : "Ready"}
                </span>
                <span className="hd-ticket-tx">
                  <b>{ticket.room}</b> ·{" "}
                  {ticket.items
                    .map((item) => `${item.qty}× ${item.name}`)
                    .join(", ")}
                </span>
                <span className="hd-req-when">
                  {elapsed(ticket.createdAtTick, tick)}
                </span>
                <button
                  type="button"
                  className="hd-req-btn"
                  onClick={() => actTicket(ticket.id)}
                >
                  {ticket.state === "new"
                    ? "Start"
                    : ticket.state === "preparing"
                      ? "Ready"
                      : "Delivered"}
                </button>
              </div>
            ))
          )}
        </section>

        <p className="hd-caption">
          Every tap on the phone appears here instantly — exactly like the
          real staff screens. Press the staff buttons and watch the
          guest&apos;s chip answer back.
        </p>
      </div>
    </div>
  );
}
