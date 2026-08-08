-- ============================================================
-- Bar Edition Phase 1 — venue editions + venue-defined stations.
-- Run AFTER 2026-08-08_ordering_module.sql. Safe to re-run.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Editions
-- ---------------------------------------------------------------

alter table public.venues
  add column if not exists edition text not null default 'restaurant';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'venues_edition_check'
  ) then
    alter table public.venues
      add constraint venues_edition_check
      check (edition in ('restaurant','bar','hotel'));
  end if;
end $$;

-- ---------------------------------------------------------------
-- 2. Stations become venue data (the hotel edition's foundation).
--    Slugs stay stable ('kitchen','bar',...); display names are
--    per-venue locale maps. Existing venues get their two stations
--    seeded exactly as they behave today.
-- ---------------------------------------------------------------

create table if not exists public.stations (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  slug       text not null check (slug ~ '^[a-z0-9_-]{1,40}$'),
  name       jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active     boolean not null default true,
  unique (venue_id, slug)
);

create index if not exists stations_venue_idx
  on public.stations (venue_id, active, sort_order);

alter table public.stations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'stations' and policyname = 'staff_read_stations') then
    create policy staff_read_stations on public.stations
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = stations.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;
end $$;

-- Seed kitchen + bar for every venue that has no stations yet.
insert into public.stations (venue_id, slug, name, sort_order)
select v.id, 'kitchen',
  '{"en":"Kitchen","es":"Cocina","da":"Køkken","sv":"Kök","no":"Kjøkken","de":"Küche","nl":"Keuken","fr":"Cuisine"}'::jsonb,
  1
from public.venues v
where not exists (select 1 from public.stations s where s.venue_id = v.id and s.slug = 'kitchen');

insert into public.stations (venue_id, slug, name, sort_order)
select v.id, 'bar',
  '{"en":"Bar","es":"Barra","da":"Bar","sv":"Bar","no":"Bar","de":"Bar","nl":"Bar","fr":"Bar"}'::jsonb,
  2
from public.venues v
where not exists (select 1 from public.stations s where s.venue_id = v.id and s.slug = 'bar');

-- ---------------------------------------------------------------
-- 3. Free the station columns from the hard-coded check so venue
--    stations can grow (housekeeping, reception, ...). Slugs are
--    validated against public.stations in the API layer.
-- ---------------------------------------------------------------

alter table public.menu_categories drop constraint if exists menu_categories_station_check;
alter table public.order_tickets   drop constraint if exists order_tickets_station_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_categories_station_format') then
    alter table public.menu_categories
      add constraint menu_categories_station_format check (station ~ '^[a-z0-9_-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_tickets_station_format') then
    alter table public.order_tickets
      add constraint order_tickets_station_format check (station ~ '^[a-z0-9_-]{1,40}$');
  end if;
end $$;
