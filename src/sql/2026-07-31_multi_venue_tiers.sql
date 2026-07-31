-- ============================================================
-- Multi-venue accounts + tier billing
--
-- Run AFTER 2026-07-31_billing_and_signup.sql, in the Supabase SQL
-- editor. Moves the subscription up from the venue to a billing
-- account that can cover several restaurants (tiers: 1/3/5/10),
-- while each restaurant keeps its OWN 14-day trial clock.
--
-- The lock rule becomes:
--   a venue is open when its own trial is still running,
--   OR its account's subscription is active (or past_due).
--
-- What this file does:
--   1. billing_accounts table (+ RLS: staff of any venue in the
--      account may read it; only the service role writes).
--   2. venues.billing_account_id, backfilled per existing owner.
--      Existing accounts are grandfathered ACTIVE with max 10 venues.
--   3. signup_create_venue() rewritten: account + first venue.
--   4. add_venue_for_owner(): venue #2..N with limit enforcement —
--      3 venues while unsubscribed (trial), tier size when subscribed.
-- ============================================================

-- 1. Accounts -------------------------------------------------------

create table if not exists billing_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id),
  billing_status text not null default 'none'
    check (billing_status in ('none', 'active', 'past_due', 'canceled')),
  plan text
    check (plan is null or plan in (
      'monthly-1','yearly-1','monthly-3','yearly-3',
      'monthly-5','yearly-5','monthly-10','yearly-10')),
  max_venues integer not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create index if not exists billing_accounts_stripe_customer_idx
  on billing_accounts (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists billing_accounts_stripe_subscription_idx
  on billing_accounts (stripe_subscription_id) where stripe_subscription_id is not null;

alter table billing_accounts enable row level security;

-- 2. Link venues ----------------------------------------------------
-- (Before the RLS policy below: the policy references this column, so
--  it must exist first.)

alter table venues
  add column if not exists billing_account_id uuid references billing_accounts (id);

create index if not exists venues_billing_account_idx
  on venues (billing_account_id) where billing_account_id is not null;

-- Staff of any venue in the account can READ it (the floor needs the
-- lock state); nobody but the service role writes.
drop policy if exists billing_accounts_staff_read on billing_accounts;
create policy billing_accounts_staff_read on billing_accounts
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1
      from venues v
      join staff s on s.venue_id = v.id
      where v.billing_account_id = billing_accounts.id
        and s.user_id = auth.uid()
        and s.active
    )
  );

-- Backfill: one account per existing OWNER, grandfathered active with
-- room for 10 venues, then link their venues.
insert into billing_accounts (owner_user_id, billing_status, max_venues)
select distinct s.user_id, 'active', 10
from staff s
where s.role = 'owner' and s.active
on conflict (owner_user_id) do nothing;

update venues v
set billing_account_id = ba.id
from staff s
join billing_accounts ba on ba.owner_user_id = s.user_id
where s.venue_id = v.id
  and s.role = 'owner'
  and s.active
  and v.billing_account_id is null;

-- Any venue with no owner staff row gets a very long personal trial so
-- this migration can never lock a hand-managed pilot out.
update venues
set trial_ends_at = now() + interval '3650 days'
where billing_account_id is null;

-- 3. Shared venue-creation core ------------------------------------

create or replace function _create_venue_core(
  p_account_id uuid,
  p_user_id uuid,
  p_venue_name text,
  p_display_name text,
  p_timezone text,
  p_locale text
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

  v_slug := lower(regexp_replace(trim(p_venue_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  -- trial_ends_at takes its default: now() + 14 days — every
  -- restaurant gets its own clock, per the product decision.
  insert into venues (name, slug, status, timezone, default_locale, locales, service_mode, branding, billing_account_id)
  values (
    trim(p_venue_name),
    v_slug,
    'active',
    coalesce(nullif(trim(p_timezone), ''), 'Europe/Madrid'),
    coalesce(nullif(trim(p_locale), ''), 'en'),
    array['en', 'es'],
    'signal',
    '{}'::jsonb,
    p_account_id
  )
  returning id into v_venue_id;

  insert into staff (user_id, venue_id, display_name, role, active)
  values (p_user_id, v_venue_id, trim(p_display_name), 'owner', true);

  insert into areas (venue_id, name, sort_order, width_m, depth_m, active)
  values (
    v_venue_id,
    jsonb_build_object('en', 'Main floor', 'es', 'Sala principal'),
    0, 10, 6, true
  );

  insert into request_types (venue_id, code, kind, label, sublabel, icon, closes_session, sort_order, active)
  values
    (v_venue_id, 'drinks', 'signal',
     jsonb_build_object('en', 'Drinks', 'es', 'Bebidas'),
     jsonb_build_object('en', 'Another round or a refill', 'es', 'Otra ronda o rellenar'),
     null, false, 1, true),
    (v_venue_id, 'assistance', 'signal',
     jsonb_build_object('en', 'Assistance', 'es', 'Asistencia'),
     jsonb_build_object('en', 'Call a waiter over', 'es', 'Llama al camarero'),
     null, false, 2, true),
    (v_venue_id, 'bill', 'signal',
     jsonb_build_object('en', 'The bill', 'es', 'La cuenta'),
     jsonb_build_object('en', 'Ready to pay', 'es', 'Listos para pagar'),
     null, true, 3, true);

  return v_venue_id;
end;
$$;

revoke execute on function _create_venue_core(uuid, uuid, text, text, text, text) from public;
revoke execute on function _create_venue_core(uuid, uuid, text, text, text, text) from anon;
revoke execute on function _create_venue_core(uuid, uuid, text, text, text, text) from authenticated;

-- 4. Signup: account + first venue ---------------------------------
-- Same signature as before, so the API route doesn't change.

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
  v_account_id uuid;
begin
  insert into billing_accounts (owner_user_id)
  values (p_user_id)
  on conflict (owner_user_id) do nothing;

  select id into v_account_id
  from billing_accounts
  where owner_user_id = p_user_id;

  return _create_venue_core(
    v_account_id, p_user_id, p_venue_name, p_display_name, p_timezone, p_locale
  );
end;
$$;

revoke execute on function signup_create_venue(uuid, text, text, text, text) from public;
revoke execute on function signup_create_venue(uuid, text, text, text, text) from anon;
revoke execute on function signup_create_venue(uuid, text, text, text, text) from authenticated;

-- 5. Add venue #2..N with limits -----------------------------------

create or replace function add_venue_for_owner(
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
  v_account billing_accounts%rowtype;
  v_count integer;
  v_limit integer;
begin
  select * into v_account
  from billing_accounts
  where owner_user_id = p_user_id;

  if v_account.id is null then
    raise exception 'no_account';
  end if;

  select count(*) into v_count
  from venues
  where billing_account_id = v_account.id;

  -- Unsubscribed (trial mode): up to 3 restaurants, each on its own
  -- 14-day clock. Subscribed: the tier's size. Canceled: no additions.
  if v_account.billing_status in ('active', 'past_due') then
    v_limit := v_account.max_venues;
  elsif v_account.billing_status = 'none' then
    v_limit := 3;
  else
    v_limit := 0;
  end if;

  if v_count >= v_limit then
    raise exception 'venue_limit_reached';
  end if;

  return _create_venue_core(
    v_account.id, p_user_id, p_venue_name, p_display_name, p_timezone, p_locale
  );
end;
$$;

revoke execute on function add_venue_for_owner(uuid, text, text, text, text) from public;
revoke execute on function add_venue_for_owner(uuid, text, text, text, text) from anon;
revoke execute on function add_venue_for_owner(uuid, text, text, text, text) from authenticated;
