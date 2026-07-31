/**
 * Billing status — the one pure rule shared by the staff surfaces and
 * the guest tap path, so "locked" can never mean two different things.
 *
 * Account model (multi-venue): the subscription lives on the owner's
 * billing account and covers up to the tier's number of restaurants,
 * while every restaurant keeps its OWN 14-day trial clock. A venue is
 * open when either is true.
 *
 * No imports on purpose: this runs in staff (cookie-authed) and guest
 * (service-role) contexts alike.
 */

export type AccountBillingStatus = "none" | "active" | "past_due" | "canceled";

export const TRIAL_DAYS = 14;

/** The venue's own trial clock, on its own. */
export function isTrialRunning(
  trialEndsAt: string | null | undefined
): boolean {
  if (!trialEndsAt) {
    return false;
  }
  const ends = Date.parse(trialEndsAt);
  return Number.isFinite(ends) && ends > Date.now();
}

/**
 * Whether a venue is locked out of service.
 *
 * - Its own trial still running → open, regardless of the account.
 * - Account active → open (covered by the subscription).
 * - Account past_due → open: a renewal hiccup must never brick a
 *   floor mid-shift; Stripe retries, and a final cancellation locks.
 * - Otherwise (trial over + account none/canceled/missing) → locked.
 */
export function isVenueLocked(
  trialEndsAt: string | null | undefined,
  accountStatus: string | null | undefined
): boolean {
  if (isTrialRunning(trialEndsAt)) {
    return false;
  }

  return accountStatus !== "active" && accountStatus !== "past_due";
}

/** Whole days of the venue's own trial left, never negative. Null when
 *  there is no meaningful trial to count (no date, or already over). */
export function trialDaysLeft(
  trialEndsAt: string | null | undefined
): number | null {
  if (!trialEndsAt) {
    return null;
  }

  const ends = Date.parse(trialEndsAt);
  if (!Number.isFinite(ends) || ends <= Date.now()) {
    return null;
  }

  return Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000));
}
