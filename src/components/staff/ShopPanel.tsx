"use client";

import { useEffect, useState } from "react";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";
import { getShopStrings } from "@/lib/i18n/shop";

/**
 * Shop — hardware for the floor, straight from the Stripe catalog.
 * The server page fetches the products; this panel only renders them
 * and opens Stripe Checkout (quantity + shipping chosen there).
 */

export type ShopProduct = {
  priceId: string;
  name: string;
  description: string | null;
  image: string | null;
  amount: number;
  currency: string;
};

function money(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function ShopPanel({
  products,
  ordered,
  cancelled,
}: {
  products: ShopProduct[];
  ordered: boolean;
  cancelled: boolean;
}) {
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getShopStrings(locale);
  // Keep shell strings in sync for anything shared later.
  void getStaffStrings(locale);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (priceId: string) => {
    setBusy(priceId);
    setError(null);
    try {
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.url) {
        setError(t.error);
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError(t.error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {ordered ? <p className="mtv-shop-notice">{t.ordered}</p> : null}
      {cancelled ? <p className="mtv-shop-notice" data-tone="muted">{t.cancelled}</p> : null}
      {error ? <p className="mtv-shop-error">{error}</p> : null}

      {products.length === 0 ? (
        <p className="mtv-shop-empty">{t.empty}</p>
      ) : (
        <div className="mtv-shop-grid">
          {products.map((product) => (
            <article key={product.priceId} className="mtv-shop-card">
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image}
                  alt={product.name}
                  className="mtv-shop-img"
                  loading="lazy"
                />
              ) : (
                <div className="mtv-shop-img mtv-shop-img-empty" aria-hidden="true" />
              )}
              <div className="mtv-shop-body">
                <h2>{product.name}</h2>
                {product.description ? <p>{product.description}</p> : null}
                <div className="mtv-shop-buyrow">
                  <span className="mtv-shop-price">
                    {money(product.amount, product.currency, locale)}
                  </span>
                  <button
                    type="button"
                    className="mtv-btn mtv-btn-primary"
                    disabled={busy !== null}
                    onClick={() => void buy(product.priceId)}
                  >
                    {busy === product.priceId ? t.buying : t.buy}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mtv-shop-foot">{t.shippingNote}</p>
    </>
  );
}
