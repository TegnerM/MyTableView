"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The ordering demo — /demo/ordering.
 *
 * The visitor plays every role at once: order on the guest phone and
 * watch the order SPLIT — food slides onto the kitchen screen only,
 * drinks onto the bar screen only. Tap Start → Ready as the station,
 * hear the bell, and the pickup task appears on the waiter panel,
 * which never shows anything but what needs carrying.
 *
 * Entirely client-simulated like DemoInteractive: no venue, no rows,
 * no cleanup. Visuals mirror the real surfaces (guest gold theme,
 * station board colours, waiter task list).
 */

/* ------------------------------------------------------------------ */
/* Demo menu — a slice of the real template data.                      */
/* ------------------------------------------------------------------ */

type Station = "kitchen" | "bar";

type DemoDish = {
  id: string;
  name: string;
  detail: string;
  price: number;
  category: "Starters" | "Mains" | "Drinks";
  station: Station;
};

const DISHES: DemoDish[] = [
  { id: "tartar", name: "Steak tartar", detail: "Capers, cured yolk", price: 14.5, category: "Starters", station: "kitchen" },
  { id: "burrata", name: "Burrata & tomato", detail: "Basil, olive oil", price: 12, category: "Starters", station: "kitchen" },
  { id: "croquetas", name: "Ham croquettes", detail: "Crisp outside", price: 9.5, category: "Starters", station: "kitchen" },
  { id: "seabass", name: "Grilled sea bass", detail: "Citrus oil", price: 22, category: "Mains", station: "kitchen" },
  { id: "paella", name: "Paella de marisco", detail: "For the table", price: 18.5, category: "Mains", station: "kitchen" },
  { id: "water", name: "Sparkling water", detail: "75 cl", price: 3, category: "Drinks", station: "bar" },
  { id: "albarino", name: "Albariño, glass", detail: "Rías Baixas", price: 5.5, category: "Drinks", station: "bar" },
  { id: "martini", name: "Espresso martini", detail: "House favourite", price: 12, category: "Drinks", station: "bar" },
];

const CATEGORIES = ["Starters", "Mains", "Drinks"] as const;

/* ------------------------------------------------------------------ */
/* Simulation state                                                    */
/* ------------------------------------------------------------------ */

type TicketState = "new" | "preparing" | "ready" | "delivered";

type SimTicket = {
  id: number;
  table: string;
  station: Station;
  items: { name: string; qty: number }[];
  state: TicketState;
  createdAtTick: number;
  readyAtTick: number | null;
};

function money(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

function elapsed(fromTick: number, nowTick: number): string {
  const seconds = Math.max(0, nowTick - fromTick);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function OrderingDemo() {
  const [tick, setTick] = useState(0);
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("Starters");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [confirmation, setConfirmation] = useState(false);
  const [tickets, setTickets] = useState<SimTicket[]>([]);
  const [bell, setBell] = useState<string | null>(null);
  const nextId = useRef(1);
  const ambientFired = useRef(false);
  const orderedOnce = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* An ambient order from another table keeps the boards alive even
     before the visitor's first tap — clearly not theirs (table 12). */
  useEffect(() => {
    if (tick >= 6 && !ambientFired.current && !orderedOnce.current) {
      ambientFired.current = true;
      setTickets((prev) => [
        ...prev,
        {
          id: nextId.current++,
          table: "Table 12",
          station: "kitchen",
          items: [{ name: "Paella de marisco", qty: 2 }],
          state: "new",
          createdAtTick: tick,
          readyAtTick: null,
        },
        {
          id: nextId.current++,
          table: "Table 12",
          station: "bar",
          items: [{ name: "Albariño, glass", qty: 2 }],
          state: "new",
          createdAtTick: tick,
          readyAtTick: null,
        },
      ]);
    }
  }, [tick]);

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const dish = DISHES.find((entry) => entry.id === id);
    return sum + (dish ? dish.price * qty : 0);
  }, 0);

  const add = useCallback((dishId: string) => {
    setCart((prev) => ({ ...prev, [dishId]: Math.min(9, (prev[dishId] ?? 0) + 1) }));
  }, []);

  const placeOrder = useCallback(() => {
    if (cartCount === 0) return;
    orderedOnce.current = true;

    const byStation = new Map<Station, { name: string; qty: number }[]>();
    for (const [id, qty] of Object.entries(cart)) {
      const dish = DISHES.find((entry) => entry.id === id);
      if (!dish || qty === 0) continue;
      const list = byStation.get(dish.station) ?? [];
      list.push({ name: dish.name, qty });
      byStation.set(dish.station, list);
    }

    setTickets((prev) => [
      ...prev,
      ...[...byStation.entries()].map(([station, items]) => ({
        id: nextId.current++,
        table: "Table 7",
        station,
        items,
        state: "new" as TicketState,
        createdAtTick: tick,
        readyAtTick: null,
      })),
    ]);

    setCart({});
    setConfirmation(true);
    window.setTimeout(() => setConfirmation(false), 2600);
  }, [cart, cartCount, tick]);

  const advance = useCallback(
    (ticketId: number) => {
      setTickets((prev) =>
        prev.map((ticket) => {
          if (ticket.id !== ticketId) return ticket;
          if (ticket.state === "new") {
            return { ...ticket, state: "preparing" };
          }
          if (ticket.state === "preparing") {
            // Ready — ring the waiter.
            setBell(
              `${ticket.station === "bar" ? "Bar" : "Kitchen"} · ${ticket.table} ready`
            );
            window.setTimeout(() => setBell(null), 3200);
            return { ...ticket, state: "ready", readyAtTick: tick };
          }
          return ticket;
        })
      );
    },
    [tick]
  );

  const deliver = useCallback((ticketId: number) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, state: "delivered" } : ticket
      )
    );
  }, []);

  const kitchenTickets = useMemo(
    () => tickets.filter((t) => t.station === "kitchen" && t.state !== "delivered"),
    [tickets]
  );
  const barTickets = useMemo(
    () => tickets.filter((t) => t.station === "bar" && t.state !== "delivered"),
    [tickets]
  );
  const waiterTasks = useMemo(
    () => tickets.filter((t) => t.state === "ready"),
    [tickets]
  );

  const dishes = DISHES.filter((dish) => dish.category === category);

  return (
    <div className="od-stage">
      {/* ---------------------------------------------- guest phone */}
      <section className="od-pane od-pane-guest">
        <header className="od-pane-head">
          <span className="od-pane-role">You — the guest</span>
          <span className="od-pane-hint">Add a dish and a drink, then order</span>
        </header>

        <div className="od-phone">
          {confirmation ? (
            <div className="od-confirm">
              <span className="od-confirm-check">✓</span>
              <h4>Order sent!</h4>
              <p>
                Watch it split: food to the kitchen,
                <br />
                drinks to the bar →
              </p>
            </div>
          ) : (
            <>
              <div className="od-phone-head">
                <h4>Menu</h4>
                <span>Table 7 · Terrace</span>
              </div>

              <div className="od-chips" role="tablist">
                {CATEGORIES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="tab"
                    aria-selected={category === entry}
                    data-active={category === entry ? "true" : "false"}
                    onClick={() => setCategory(entry)}
                  >
                    {entry}
                  </button>
                ))}
              </div>

              <div className="od-dishes">
                {dishes.map((dish) => (
                  <button
                    key={dish.id}
                    type="button"
                    className="od-dish"
                    onClick={() => add(dish.id)}
                  >
                    <span className="od-dish-text">
                      <span className="od-dish-name">{dish.name}</span>
                      <span className="od-dish-detail">{dish.detail}</span>
                      <span className="od-dish-price">{money(dish.price)}</span>
                    </span>
                    <span className="od-dish-add" aria-hidden="true">
                      {cart[dish.id] ? `${cart[dish.id]}×` : "+"}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="od-cartbar"
                data-empty={cartCount === 0 ? "true" : "false"}
                onClick={placeOrder}
              >
                {cartCount === 0 ? (
                  <span>Your order is empty</span>
                ) : (
                  <>
                    <span>
                      <b className="od-cart-count">{cartCount}</b> Place order
                    </span>
                    <b>{money(cartTotal)}</b>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ---------------------------------------------- kitchen */}
      <StationPane
        title="The kitchen"
        subtitle="sees only the food"
        station="kitchen"
        tickets={kitchenTickets}
        tick={tick}
        onAdvance={advance}
      />

      {/* ---------------------------------------------- bar */}
      <StationPane
        title="The bar"
        subtitle="sees only the drinks"
        station="bar"
        tickets={barTickets}
        tick={tick}
        onAdvance={advance}
      />

      {/* ---------------------------------------------- waiter */}
      <section className="od-pane od-pane-waiter">
        <header className="od-pane-head">
          <span className="od-pane-role">The waiters</span>
          <span className="od-pane-hint">only what needs carrying</span>
        </header>

        <div className="od-waiter">
          {bell ? (
            <div className="od-bell" role="status">
              🔔 <strong>{bell}</strong>
            </div>
          ) : null}

          {waiterTasks.length === 0 ? (
            <p className="od-waiter-empty">
              Nothing to carry.
              <br />
              <span>
                Tasks appear here the moment a station rings “Ready”.
              </span>
            </p>
          ) : (
            waiterTasks.map((ticket) => (
              <div key={ticket.id} className="od-task">
                <span className="od-task-icon" aria-hidden="true">
                  {ticket.station === "bar" ? "🥂" : "🍽"}
                </span>
                <span className="od-task-text">
                  <b>{ticket.table}</b>
                  <span>
                    {ticket.items
                      .map((item) => `${item.qty}× ${item.name}`)
                      .join(", ")}
                  </span>
                  <em>
                    ready {elapsed(ticket.readyAtTick ?? tick, tick)} ·{" "}
                    {ticket.station === "bar" ? "bar" : "kitchen"}
                  </em>
                </span>
                <button
                  type="button"
                  className="od-task-btn"
                  onClick={() => deliver(ticket.id)}
                >
                  Delivered
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One station board (kitchen or bar)                                  */
/* ------------------------------------------------------------------ */

function StationPane({
  title,
  subtitle,
  station,
  tickets,
  tick,
  onAdvance,
}: {
  title: string;
  subtitle: string;
  station: Station;
  tickets: SimTicket[];
  tick: number;
  onAdvance: (ticketId: number) => void;
}) {
  return (
    <section className="od-pane od-pane-station" data-station={station}>
      <header className="od-pane-head">
        <span className="od-pane-role">
          <i className="od-station-dot" data-station={station} aria-hidden="true" />
          {title}
        </span>
        <span className="od-pane-hint">{subtitle}</span>
      </header>

      <div className="od-board">
        {tickets.length === 0 ? (
          <p className="od-board-empty">
            No open tickets.
            <br />
            <span>
              {station === "kitchen"
                ? "Order some food on the guest phone →"
                : "Order a drink on the guest phone →"}
            </span>
          </p>
        ) : (
          tickets.map((ticket) => (
            <article key={ticket.id} className="od-ticket" data-state={ticket.state}>
              <header>
                <b>{ticket.table}</b>
                <span className="od-ticket-age">
                  {elapsed(ticket.createdAtTick, tick)}
                </span>
              </header>
              <ul>
                {ticket.items.map((item, index) => (
                  <li key={index}>
                    <b>{item.qty}×</b> {item.name}
                  </li>
                ))}
              </ul>
              {ticket.state === "new" ? (
                <button
                  type="button"
                  className="od-ticket-btn od-ticket-btn-start"
                  onClick={() => onAdvance(ticket.id)}
                >
                  Start
                </button>
              ) : ticket.state === "preparing" ? (
                <button
                  type="button"
                  className="od-ticket-btn od-ticket-btn-ready"
                  onClick={() => onAdvance(ticket.id)}
                >
                  Ready — ring the waiter
                </button>
              ) : (
                <p className="od-ticket-waiting">Waiting for the waiter…</p>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
