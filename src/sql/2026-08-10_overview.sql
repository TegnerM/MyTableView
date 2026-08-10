-- ============================================================
-- Property Overview — staff presence for the "Staff active" stat.
-- Run anytime (independent of other migrations). Safe to re-run.
-- ============================================================

alter table public.staff
  add column if not exists last_seen_at timestamptz;

comment on column public.staff.last_seen_at is
  'Stamped (throttled) by the staff identity check on every staff '
  'request. "Active" = a screen this account is signed into has '
  'talked to the server recently. Not a shift roster.';
