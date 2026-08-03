import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getStripe } from "@/lib/billing/stripe";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  VouchersPanel,
  type VoucherRow,
} from "@/components/admin/VouchersPanel";
import "../admin.css";

/**
 * Vouchers — promotion codes straight from Stripe (the source of
 * truth for discounts and redemption counts). No local tables; the
 * checkout already accepts codes.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminVouchersPage() {
  const gate = await requireAdmin();

  if (!gate.ok) {
    if (gate.reason === "no_session") redirect("/admin/sign-in");
    if (gate.reason === "mfa_enroll" || gate.reason === "mfa_required")
      redirect("/admin/mfa");
    notFound();
  }

  let rows: VoucherRow[] = [];
  let stripeError: string | null = null;

  try {
    const stripe = getStripe();
    const promoCodes = await stripe.promotionCodes.list({
      limit: 100,
      expand: ["data.promotion.coupon"],
    });

    rows = promoCodes.data.map((promo) => {
      const coupon =
        typeof promo.promotion.coupon === "object"
          ? promo.promotion.coupon
          : null;
      const durationLabel =
        coupon === null
          ? "—"
          : coupon.duration === "forever"
            ? "forever"
            : coupon.duration === "once"
              ? "first payment"
              : `${coupon.duration_in_months} months`;

      return {
        id: promo.id,
        code: promo.code,
        percentOff: coupon?.percent_off ?? null,
        durationLabel,
        redeemed: promo.times_redeemed,
        maxRedemptions: promo.max_redemptions ?? null,
        active: promo.active,
        created: new Date(promo.created * 1000).toISOString().slice(0, 10),
      };
    });
  } catch (error) {
    stripeError = error instanceof Error ? error.message : "Stripe unavailable";
  }

  return (
    <AdminShell active="vouchers" email={gate.email}>
      <header className="mtv-admin-head">
        <h1>Vouchers</h1>
        <p>
          Discount codes restaurants type at checkout. Stripe applies the
          discount and counts redemptions; deactivating stops new uses
          without affecting existing subscriptions.
        </p>
      </header>

      <div className="mtv-admin-card">
        {stripeError ? (
          <p className="mtv-admin-error">Stripe error: {stripeError}</p>
        ) : (
          <VouchersPanel rows={rows} />
        )}
      </div>
    </AdminShell>
  );
}
