-- ============================================================
-- Billing + self-serve signup
--
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor).
-- Safe to run once; re-running will error on the existing function,
-- which is fine (drop it first if you need to re-apply).
--
-- What it does:
--   1. Adds billing columns to venues (14-day trial by default).
--   2. Grandfathers every EXISTING venue to 'active' so your pilot
--      (Armonía Beach Club) is never locked by this migration.
--   3. Creates signup_create_venue(): one atomic call that creates
--      the venue, the owner staff row, a starter zone and the three
--      default request types. Called only by the server with the
--      service role key — never from the browser.
-- ============================================================

-- 1. Billing columns ------------------------------------------------

alter table venues
  add column if not exists trial_ends_at timestamptz
    not null default (now() + interval '14 days');

alter table venues
  add column if not exists billing_status text
    not null default 'trialing';

alter table venues
  add column if not exists stripe_customer_id text;

alter table venues
  add column if not exists stripe_subscription_id text;

alter table venues
  add column if not exists plan text;

-- One constraint each, added defensively so a re-run doesn't error.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venues_billing_status_check'
  ) then
    alter table venues add constraint venues_billing_status_check
      check (billing_status in ('trialing', 'active', 'past_due', 'canceled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'venues_plan_check'
  ) then
    alter table venues add constraint venues_plan_check
      check (plan is null or plan in ('monthly', 'yearly'));
  end if;
end $$;

-- Webhooks look venues up by Stripe IDs.
create index if not exists venues_stripe_customer_idx
  on venues (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists venues_stripe_subscription_idx
  on venues (stripe_subscription_id) where stripe_subscription_id is not null;

-- 2. Grandfather existing venues ------------------------------------
-- Every venue that exists BEFORE self-serve signup launches was set up
-- by hand and should not suddenly hit a trial wall.

update venues set billing_status = 'active' where billing_status = 'trialing';

-- 3. Signup function ------------------------------------------------
-- SECURITY DEFINER: runs with the function owner's rights so it can
-- insert across venues/staff/areas/request_types in one transaction.
-- The API route verifies the caller's auth session BEFORE calling this
-- and passes the verified user id — the function trusts its caller,
-- which is why execute is revoked from anon/authenticated below.

create or replace function signup_create_venue(
  p_user_id uuid,
  p_venue_name text,
  p_display_name text,
  p_timezone text default 'Europe/Madrid',
  p_locale text default 'en'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_slug text;
begin
  if p_venue_name is null or length(trim(p_venue_name)) < 2 then
    raise exception 'venue name too short';
  end if;

  if p_display_name is null or length(trim(p_display_name)) < 1 then
    raise exception 'display name required';
  end if;

  -- Unique, URL-safe slug: the name, plus 6 random hex chars.
  v_slug := lower(regexp_replace(trim(p_venue_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  insert into venues (name, slug, status, timezone, default_locale, locales, service_mode, branding)
  values (
    trim(p_venue_name),
    v_slug,
    'active',
    coalesce(nullif(trim(p_timezone), ''), 'Europe/Madrid'),
    coalesce(nullif(trim(p_locale), ''), 'en'),
    array['en', 'es'],
    'signal',
    '{}'::jsonb
  )
  returning id into v_venue_id;

  insert into staff (user_id, venue_id, display_name, role, active)
  values (p_user_id, v_venue_id, trim(p_display_name), 'owner', true);

  -- A starter zone so the layout editor opens ready to drag tables.
  insert into areas (venue_id, name, sort_order, width_m, depth_m, active)
  values (
    v_venue_id,
    jsonb_build_object('en', 'Main floor', 'es', 'Sala principal'),
    0, 10, 6, true
  );

  -- The three default guest buttons. Bill closes the session, which is
  -- what triggers the food & service rating questions.
  insert into request_types (venue_id, code, kind, label, sublabel, icon, closes_session, sort_order, active)
  values
    (
      v_venue_id, 'drinks', 'signal',
      jsonb_build_object('en', 'Drinks', 'es', 'Bebidas'),
      jsonb_build_object('en', 'Another round or a refill', 'es', 'Otra ronda o rellenar'),
      null, false, 1, true
    ),
    (
      v_venue_id, 'assistance', 'signal',
      jsonb_build_object('en', 'Assistance', 'es', 'Asistencia'),
      jsonb_build_object('en', 'Call a waiter over', 'es', 'Llama al camarero'),
      null, false, 2, true
    ),
    (
      v_venue_id, 'bill', 'signal',
      jsonb_build_object('en', 'The bill', 'es', 'La cuenta'),
      jsonb_build_object('en', 'Ready to pay', 'es', 'Listos para pagar'),
      null, true, 3, true
    );

  return v_venue_id;
end;
$$;

-- Only the service role may call this.
revoke execute on function signup_create_venue(uuid, text, text, text, text) from public;
revoke execute on function signup_create_venue(uuid, text, text, text, text) from anon;
revoke execute on function signup_create_venue(uuid, text, text, text, text) from authenticated;
