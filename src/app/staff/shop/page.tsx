import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getStripe } from "@/lib/billing/stripe";
import { StaffShell } from "@/components/staff/StaffShell";
import { ShopPanel, type ShopProduct } from "@/components/staff/ShopPanel";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
import { getShopStrings } from "@/lib/i18n/shop";
import "../floor/floor.css";
import "./shop.css";

/**
 * /staff/shop — hardware store for owners and managers.
 *
 * Stripe is the catalog: every ACTIVE product whose default price is
 * one-time appears here automatically — Michael adds a product with a
 * photo and a price in the Stripe dashboard and it's on this page.
 * Subscription products (the plans) are excluded by the one-time
 * filter. Photos: the product's Stripe image when set, otherwise a
 * file in /public named exactly like the product.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ordered?: string; cancelled?: string }>;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }
  if (identity.role !== "owner" && identity.role !== "manager") {
    redirect("/staff/floor");
  }

  const { ordered, cancelled } = await searchParams;
  const store = await cookies();
  const headerList = await headers();
  const locale = resolveStaffLocale(
    store.get(STAFF_LANG_COOKIE)?.value,
    headerList.get("accept-language")
  );
  const t = getShopStrings(locale);
  void getStaffStrings(locale);

  let products: ShopProduct[] = [];
  try {
    const stripe = getStripe();
    const list = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ["data.default_price"],
    });

    products = list.data
      .map((product): ShopProduct | null => {
        const price = product.default_price;
        if (!price || typeof price === "string") return null;
        if (price.type !== "one_time" || !price.active) return null;
        if (price.unit_amount === null) return null;
        return {
          priceId: price.id,
          name: product.name,
          description: product.description,
          image:
            product.images[0] ??
            `/${encodeURIComponent(product.name)}.png`,
          amount: price.unit_amount,
          currency: price.currency,
        };
      })
      .filter((p): p is ShopProduct => p !== null)
      .sort((a, b) => b.amount - a.amount);
  } catch (error) {
    console.error(
      "shop: product list failed",
      error instanceof Error ? error.message : error
    );
  }

  return (
    <StaffShell
      active="shop"
      displayName={identity.displayName}
      role={identity.role}
      venueId={identity.venueId}
      venues={identity.venues}
    >
      <main className="mtv-shop">
        <header className="mtv-shop-head">
          <h1>{t.title}</h1>
          <p>{t.sub}</p>
        </header>
        <ShopPanel
          products={products}
          ordered={ordered === "1"}
          cancelled={cancelled === "1"}
        />
      </main>
    </StaffShell>
  );
}
