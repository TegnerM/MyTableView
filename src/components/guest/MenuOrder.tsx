"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { pickLocale, type LocaleMap } from "@/lib/i18n/guest";
import type { UiStringsShape } from "@/lib/i18n/guest";
import { getAllergen } from "@/lib/menu/allergens";
import {
  formatCents,
  photoUrl,
  type MenuCategory,
  type MenuItem,
  type VenueMenu,
} from "@/lib/menu/types";

/**
 * The guest ordering flow — entry card, full-screen menu, dish sheet
 * with options, cart, confirmation. One client component, no routing:
 * the guest never leaves /t/[tagId], and closing the overlay lands
 * them exactly where they were.
 *
 * Prices shown here are cosmetic; the server re-reads the menu and
 * prices every line itself. A stale tab can still submit — the server
 * answers item_unavailable and the guest sees a calm message.
 */

type Props = {
  tagId: string;
  locale: string;
  venueDefaultLocale: string;
  tableLabel: string;
  serviceChargePct: number;
  menu: VenueMenu;
  strings: UiStringsShape;
  /** "gold" (restaurant, default) or "bar" — pure CSS reskin. */
  theme?: "gold" | "bar" | "hotel";
  /** "card" renders the entry card (default); "none" hides it — the
   *  host (e.g. the bar home) opens the overlay via externalOpen. */
  entry?: "card" | "none";
  /** Flip to true to open the menu overlay from outside. */
  externalOpen?: boolean;
  /** Category to land on when opened externally (e.g. the bar home's
   *  Snacks tile opens straight onto the food). Null = keep current. */
  externalOpenCategoryId?: string | null;
  onExternalOpenHandled?: () => void;
};

type CartLine = {
  key: string;
  item: MenuItem;
  optionIds: string[];
  quantity: number;
};

type Screen =
  | { kind: "closed" }
  | { kind: "menu" }
  | { kind: "item"; item: MenuItem }
  | { kind: "cart" }
  | { kind: "done" };

function lineKey(itemId: string, optionIds: string[]): string {
  return `${itemId}|${[...optionIds].sort().join(",")}`;
}

function lineUnitPrice(line: CartLine): number {
  const surcharges = line.item.options
    .filter((option) => line.optionIds.includes(option.id))
    .reduce((sum, option) => sum + option.surchargeCents, 0);
  return line.item.priceCents + surcharges;
}

export function MenuOrder({
  tagId,
  locale,
  venueDefaultLocale,
  tableLabel,
  serviceChargePct,
  menu,
  strings,
  theme = "gold",
  entry = "card",
  externalOpen = false,
  externalOpenCategoryId = null,
  onExternalOpenHandled,
}: Props) {
  const t = strings;
  const [screen, setScreen] = useState<Screen>({ kind: "closed" });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => menu.categories[0]?.id ?? null
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A host page (the bar home) can open the overlay from its own
  // buttons instead of the built-in entry card.
  useEffect(() => {
    if (externalOpen) {
      if (
        externalOpenCategoryId &&
        menu.categories.some((category) => category.id === externalOpenCategoryId)
      ) {
        setActiveCategoryId(externalOpenCategoryId);
      }
      setScreen({ kind: "menu" });
      onExternalOpenHandled?.();
    }
  }, [externalOpen, externalOpenCategoryId, menu.categories, onExternalOpenHandled]);

  const pick = useCallback(
    (map: LocaleMap) => pickLocale(map, locale, venueDefaultLocale),
    [locale, venueDefaultLocale]
  );

  const activeCategory: MenuCategory | null =
    menu.categories.find((category) => category.id === activeCategoryId) ??
    menu.categories[0] ??
    null;

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce(
    (sum, line) => sum + lineUnitPrice(line) * line.quantity,
    0
  );
  const serviceCents = Math.round((subtotal * serviceChargePct) / 100);
  const total = subtotal + serviceCents;

  const addLine = useCallback(
    (item: MenuItem, optionIds: string[], quantity: number) => {
      const key = lineKey(item.id, optionIds);
      setCart((prev) => {
        const existing = prev.find((line) => line.key === key);
        if (existing) {
          return prev.map((line) =>
            line.key === key
              ? { ...line, quantity: Math.min(9, line.quantity + quantity) }
              : line
          );
        }
        return [...prev, { key, item, optionIds, quantity }];
      });
    },
    []
  );

  const changeQuantity = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(9, line.quantity + delta) }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }, []);

  const placeOrder = useCallback(async () => {
    if (sending || cart.length === 0) {
      return;
    }
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/guest/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId,
          note: note.trim() === "" ? undefined : note.trim(),
          lines: cart.map((line) => ({
            itemId: line.item.id,
            quantity: line.quantity,
            optionIds: line.optionIds,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
      } | null;

      if (payload?.ok) {
        setCart([]);
        setNote("");
        setScreen({ kind: "done" });
        return;
      }

      if (payload?.reason === "rate_limited") {
        setError(t.menuOrderRateLimited);
      } else if (payload?.reason === "item_unavailable") {
        setError(t.menuItemUnavailable);
      } else {
        setError(t.menuOrderFailed);
      }
    } catch {
      setError(t.menuOrderFailed);
    } finally {
      setSending(false);
    }
  }, [sending, cart, tagId, note, t]);

  if (menu.categories.length === 0) {
    return null;
  }

  return (
    <>
      {/* Entry card — sits at the top of the request area. */}
      {entry === "card" ? (
      <button
        type="button"
        className="mtv-menu-entry"
        onClick={() => setScreen({ kind: "menu" })}
      >
        <span className="mtv-menu-entry-icon" aria-hidden="true">
          <MenuBookIcon />
        </span>
        <span className="mtv-menu-entry-text">
          <span className="mtv-menu-entry-label">{t.menuViewTitle}</span>
          <span className="mtv-menu-entry-sub">{t.menuViewSub}</span>
        </span>
        <span className="mtv-menu-entry-chevron" aria-hidden="true">
          <Chevron />
        </span>
      </button>
      ) : null}

      {screen.kind !== "closed" ? (
        <div className="mtv-menu-overlay" data-theme={theme} role="dialog" aria-modal="true">
          {screen.kind === "menu" && activeCategory ? (
            <MenuScreen
              t={t}
              pick={pick}
              locale={locale}
              tableLabel={tableLabel}
              categories={menu.categories}
              activeCategory={activeCategory}
              onPickCategory={setActiveCategoryId}
              cartCount={cartCount}
              subtotal={subtotal}
              onClose={() => setScreen({ kind: "closed" })}
              onOpenItem={(item) => setScreen({ kind: "item", item })}
              onOpenCart={() => setScreen({ kind: "cart" })}
              onQuickAdd={(item) => addLine(item, [], 1)}
            />
          ) : null}

          {screen.kind === "item" ? (
            <ItemScreen
              t={t}
              pick={pick}
              locale={locale}
              item={screen.item}
              onBack={() => setScreen({ kind: "menu" })}
              onAdd={(optionIds, quantity) => {
                addLine(screen.item, optionIds, quantity);
                setScreen({ kind: "menu" });
              }}
            />
          ) : null}

          {screen.kind === "cart" ? (
            <CartScreen
              t={t}
              pick={pick}
              locale={locale}
              tableLabel={tableLabel}
              cart={cart}
              note={note}
              onNote={setNote}
              serviceChargePct={serviceChargePct}
              subtotal={subtotal}
              serviceCents={serviceCents}
              total={total}
              sending={sending}
              error={error}
              onBack={() => setScreen({ kind: "menu" })}
              onChangeQuantity={changeQuantity}
              onPlaceOrder={() => void placeOrder()}
            />
          ) : null}

          {screen.kind === "done" ? (
            <DoneScreen
              t={t}
              tableLabel={tableLabel}
              onKeepOrdering={() => setScreen({ kind: "menu" })}
              onClose={() => setScreen({ kind: "closed" })}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ menu */

function MenuScreen({
  t,
  pick,
  locale,
  tableLabel,
  categories,
  activeCategory,
  onPickCategory,
  cartCount,
  subtotal,
  onClose,
  onOpenItem,
  onOpenCart,
  onQuickAdd,
}: {
  t: UiStringsShape;
  pick: (map: LocaleMap) => string;
  locale: string;
  tableLabel: string;
  categories: MenuCategory[];
  activeCategory: MenuCategory;
  onPickCategory: (id: string) => void;
  cartCount: number;
  subtotal: number;
  onClose: () => void;
  onOpenItem: (item: MenuItem) => void;
  onOpenCart: () => void;
  onQuickAdd: (item: MenuItem) => void;
}) {
  return (
    <div className="mtv-menu-screen">
      <header className="mtv-menu-head">
        <div className="mtv-menu-head-row">
          <button
            type="button"
            className="mtv-menu-back"
            onClick={onClose}
            aria-label={t.menuBack}
          >
            <BackChevron />
          </button>
          <div className="mtv-menu-head-title">
            <h2>{t.menuTitle}</h2>
            <span>{tableLabel}</span>
          </div>
          <span className="mtv-menu-head-spacer" aria-hidden="true" />
        </div>

        <div className="mtv-menu-chips" role="tablist">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={category.id === activeCategory.id}
              className="mtv-menu-chip"
              data-active={category.id === activeCategory.id ? "true" : "false"}
              onClick={() => onPickCategory(category.id)}
            >
              {pick(category.name)}
            </button>
          ))}
        </div>
      </header>

      <div className="mtv-menu-list">
        {activeCategory.items.map((item) => {
          const photo = photoUrl(item.photo);
          const description = pick(item.description);
          return (
            <button
              key={item.id}
              type="button"
              className="mtv-dish"
              data-available={item.available ? "true" : "false"}
              onClick={() => (item.available ? onOpenItem(item) : undefined)}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="mtv-dish-photo"
                  loading="lazy"
                />
              ) : (
                <span className="mtv-dish-photo mtv-dish-photo-empty" aria-hidden="true" />
              )}

              <span className="mtv-dish-info">
                <span className="mtv-dish-name">{pick(item.name)}</span>
                {description ? (
                  <span className="mtv-dish-desc">{description}</span>
                ) : null}
                <span className="mtv-dish-meta">
                  <span className="mtv-dish-price">
                    {formatCents(item.priceCents, locale)}
                  </span>
                  {item.available ? (
                    <AllergenBadges codes={item.allergens} locale={locale} />
                  ) : (
                    <span className="mtv-dish-soldout">{t.menuSoldOut}</span>
                  )}
                </span>
              </span>

              <span
                className="mtv-dish-add"
                aria-hidden="true"
                onClick={(event) => {
                  // Quick add without options — the card click opens
                  // the sheet; the + adds one plain unit directly.
                  if (item.available && item.options.length === 0) {
                    event.stopPropagation();
                    onQuickAdd(item);
                  }
                }}
              >
                +
              </span>
            </button>
          );
        })}
      </div>

      {cartCount > 0 ? (
        <button type="button" className="mtv-cart-bar" onClick={onOpenCart}>
          <span className="mtv-cart-bar-label">
            <span className="mtv-cart-bar-count">{cartCount}</span>
            {t.menuViewOrder}
          </span>
          <span className="mtv-cart-bar-total">
            {formatCents(subtotal, locale)}
          </span>
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ item */

function ItemScreen({
  t,
  pick,
  locale,
  item,
  onBack,
  onAdd,
}: {
  t: UiStringsShape;
  pick: (map: LocaleMap) => string;
  locale: string;
  item: MenuItem;
  onBack: () => void;
  onAdd: (optionIds: string[], quantity: number) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const photo = photoUrl(item.photo);

  const unit =
    item.priceCents +
    item.options
      .filter((option) => selected.includes(option.id))
      .reduce((sum, option) => sum + option.surchargeCents, 0);

  const toggle = (optionId: string) => {
    setSelected((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  return (
    <div className="mtv-item-screen">
      <div className="mtv-item-photo-wrap">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={pick(item.name)} className="mtv-item-photo" />
        ) : (
          <div className="mtv-item-photo mtv-item-photo-empty" aria-hidden="true" />
        )}
        <button
          type="button"
          className="mtv-menu-back mtv-item-back"
          onClick={onBack}
          aria-label={t.menuBack}
        >
          <BackChevron />
        </button>
      </div>

      <div className="mtv-item-sheet">
        <div className="mtv-item-handle" aria-hidden="true" />
        <div className="mtv-item-title-row">
          <h2>{pick(item.name)}</h2>
          <span className="mtv-item-price">{formatCents(unit, locale)}</span>
        </div>

        {pick(item.description) ? (
          <p className="mtv-item-desc">{pick(item.description)}</p>
        ) : null}

        <AllergenPills codes={item.allergens} locale={locale} />

        {item.options.length > 0 ? (
          <>
            <p className="mtv-item-options-title">{t.menuOptions}</p>
            <div className="mtv-item-options">
              {item.options.map((option) => {
                const on = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="mtv-item-option"
                    data-on={on ? "true" : "false"}
                    onClick={() => toggle(option.id)}
                  >
                    <span className="mtv-item-option-box" aria-hidden="true" />
                    <span className="mtv-item-option-name">
                      {pick(option.name)}
                    </span>
                    {option.surchargeCents > 0 ? (
                      <span className="mtv-item-option-price">
                        +{formatCents(option.surchargeCents, locale)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="mtv-item-actions">
          <div className="mtv-qty">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="−"
            >
              −
            </button>
            <b>{quantity}</b>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(9, q + 1))}
              aria-label="+"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="mtv-item-add"
            onClick={() => onAdd(selected, quantity)}
          >
            {t.menuAddToOrder} · {formatCents(unit * quantity, locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ cart */

function CartScreen({
  t,
  pick,
  locale,
  tableLabel,
  cart,
  note,
  onNote,
  serviceChargePct,
  subtotal,
  serviceCents,
  total,
  sending,
  error,
  onBack,
  onChangeQuantity,
  onPlaceOrder,
}: {
  t: UiStringsShape;
  pick: (map: LocaleMap) => string;
  locale: string;
  tableLabel: string;
  cart: CartLine[];
  note: string;
  onNote: (value: string) => void;
  serviceChargePct: number;
  subtotal: number;
  serviceCents: number;
  total: number;
  sending: boolean;
  error: string | null;
  onBack: () => void;
  onChangeQuantity: (key: string, delta: number) => void;
  onPlaceOrder: () => void;
}) {
  return (
    <div className="mtv-menu-screen mtv-cart-screen">
      <header className="mtv-menu-head">
        <div className="mtv-menu-head-row">
          <button
            type="button"
            className="mtv-menu-back"
            onClick={onBack}
            aria-label={t.menuBack}
          >
            <BackChevron />
          </button>
          <div className="mtv-menu-head-title">
            <h2>{t.menuYourOrder}</h2>
            <span>{tableLabel}</span>
          </div>
          <span className="mtv-menu-head-spacer" aria-hidden="true" />
        </div>
      </header>

      <div className="mtv-cart-list">
        {cart.map((line) => {
          const photo = photoUrl(line.item.photo);
          const chosen = line.item.options.filter((option) =>
            line.optionIds.includes(option.id)
          );
          return (
            <div key={line.key} className="mtv-cart-item">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="mtv-cart-photo" loading="lazy" />
              ) : (
                <span className="mtv-cart-photo mtv-dish-photo-empty" aria-hidden="true" />
              )}
              <span className="mtv-cart-info">
                <span className="mtv-cart-name">{pick(line.item.name)}</span>
                {chosen.length > 0 ? (
                  <span className="mtv-cart-options">
                    {chosen.map((option) => pick(option.name)).join(" · ")}
                  </span>
                ) : null}
                <span className="mtv-cart-price">
                  {formatCents(lineUnitPrice(line), locale)}
                </span>
              </span>
              <span className="mtv-cart-qty">
                <button
                  type="button"
                  onClick={() => onChangeQuantity(line.key, -1)}
                  aria-label="−"
                >
                  −
                </button>
                <b>{line.quantity}</b>
                <button
                  type="button"
                  onClick={() => onChangeQuantity(line.key, 1)}
                  aria-label="+"
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <label className="mtv-cart-note">
        <span className="sr-only">{t.menuAddNote}</span>
        <textarea
          value={note}
          maxLength={280}
          rows={2}
          placeholder={`✎ ${t.menuAddNote}`}
          onChange={(event) => onNote(event.target.value)}
        />
      </label>

      <div className="mtv-cart-totals">
        <div className="mtv-cart-row">
          <span>{t.menuSubtotal}</span>
          <span>{formatCents(subtotal, locale)}</span>
        </div>
        {serviceChargePct > 0 ? (
          <div className="mtv-cart-row">
            <span>
              {t.menuService.replace("{pct}", String(serviceChargePct))}
            </span>
            <span>{formatCents(serviceCents, locale)}</span>
          </div>
        ) : null}
        <div className="mtv-cart-row mtv-cart-row-total">
          <span>{t.menuTotal}</span>
          <span>{formatCents(total, locale)}</span>
        </div>
      </div>

      <p className="mtv-cart-payline">{t.menuPayAtTable}</p>

      {error ? <p className="mtv-cart-error">{error}</p> : null}

      <button
        type="button"
        className="mtv-cart-place"
        disabled={sending || cart.length === 0}
        onClick={onPlaceOrder}
      >
        {sending ? "…" : t.menuPlaceOrder}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ done */

function DoneScreen({
  t,
  tableLabel,
  onKeepOrdering,
  onClose,
}: {
  t: UiStringsShape;
  tableLabel: string;
  onKeepOrdering: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mtv-done-screen">
      <span className="mtv-done-check" aria-hidden="true">
        ✓
      </span>
      <h2>{t.menuOrderSentTitle}</h2>
      <p>{t.menuOrderSentBody.replace("{table}", tableLabel)}</p>
      <span className="mtv-done-cloche" aria-hidden="true">
        <ClocheIcon />
      </span>
      <button type="button" className="mtv-done-primary" onClick={onKeepOrdering}>
        {t.menuKeepOrdering}
      </button>
      <button type="button" className="mtv-done-secondary" onClick={onClose}>
        {t.menuBackToStart}
      </button>
    </div>
  );
}

/* ------------------------------------------------------- allergens */

function AllergenBadges({ codes, locale }: { codes: string[]; locale: string }) {
  if (codes.length === 0) {
    return null;
  }
  return (
    <span className="mtv-allergen-badges">
      {codes.map((code) => {
        const info = getAllergen(code);
        if (!info) {
          return null;
        }
        const name = info.names[locale] ?? info.names.en;
        return (
          <span
            key={code}
            className="mtv-allergen-badge"
            data-dietary={info.dietary ? "true" : "false"}
            title={name}
            aria-label={name}
          >
            {info.letter}
          </span>
        );
      })}
    </span>
  );
}

function AllergenPills({ codes, locale }: { codes: string[]; locale: string }) {
  if (codes.length === 0) {
    return null;
  }
  return (
    <div className="mtv-allergen-pills">
      {codes.map((code) => {
        const info = getAllergen(code);
        if (!info) {
          return null;
        }
        const name = info.names[locale] ?? info.names.en;
        return (
          <span
            key={code}
            className="mtv-allergen-pill"
            data-dietary={info.dietary ? "true" : "false"}
          >
            <span aria-hidden="true">{info.emoji}</span> {name}
          </span>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- icons */

function MenuBookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mtv-icon-svg" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h9a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" />
      <path d="M16 6h3v12a2 2 0 0 1-2 2h-1" />
      <path d="M8.5 9h5" />
      <path d="M8.5 13h5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="mtv-chevron-svg" aria-hidden="true">
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackChevron() {
  return (
    <svg viewBox="0 0 24 24" className="mtv-chevron-svg" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClocheIcon() {
  return (
    <svg width="70" height="52" viewBox="0 0 70 52" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M8 40h54" />
      <path d="M12 40a23 23 0 0 1 46 0" />
      <path d="M35 13v-3" />
      <circle cx="35" cy="8" r="2.4" />
    </svg>
  );
}
