/**
 * Billing status — the one pure rule shared by the staff surfaces and
 * the guest tap path, so "locked" can never mean two different things.
 *
 * No imports on purpose: this runs in staff (cookie-authed) and guest
 * (service-role) contexts alike.
 */

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled";

export const TRIAL_DAYS = 14;

/**
 * Whether the venue is locked out of service.
 *
 * - active: paying — open.
 * - past_due: a renewal failed; Stripe is retrying. Kept OPEN so a
 *   card hiccup never bricks a floor mid-shift; Stripe flips it to
 *   canceled if every retry fails, and THAT locks.
 * - trialing: open until the trial clock runs out.
 * - canceled (or anything unknown): locked.
 */
export function isBillingLocked(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined
): boolean {
  if (status === "active" || status === "past_due") {
    return false;
  }

  if (status === "trialing") {
    if (!trialEndsAt) {
      return false;
    }
    const ends = Date.parse(trialEndsAt);
    return Number.isFinite(ends) && ends < Date.now();
  }

  // canceled, or a value this build doesn't know: locked. A venue with
  // NO billing row at all never reaches here — getVenueBilling fails
  // open on missing data.
  return true;
}

/** Whole days of trial left, never negative. Null when not trialing. */
export function trialDaysLeft(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined
): number | null {
  if (status !== "trialing" || !trialEndsAt) {
    return null;
  }

  const ends = Date.parse(trialEndsAt);
  if (!Number.isFinite(ends)) {
    return null;
  }

  return Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000));
}
