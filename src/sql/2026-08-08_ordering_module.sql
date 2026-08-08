-- ============================================================
-- Ordering module — menus, orders, kitchen/bar tickets, add-on
-- billing. Run AFTER the two 2026-07-31 migrations.
--
-- Paste the whole file into Supabase Dashboard → SQL Editor.
-- Safe to re-run: everything is IF NOT EXISTS / guarded.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. Venue + account columns
-- ---------------------------------------------------------------

alter table public.venues
  add column if not exists ordering_active boolean not null default false;

-- Informational service charge shown in the guest cart (0–20 %).
alter table public.venues
  add column if not exists service_charge_pct numeric(4,1) not null default 0;

-- Menu translation mode: true = the server machine-translates menu
-- text into the venue's other guest languages on save; false = the
-- owner writes every language by hand in the editor.
alter table public.venues
  add column if not exists menu_auto_translate boolean not null default true;

-- Paid ordering seats, mirrored from the Stripe subscription item by
-- the webhook / toggle API. Billing bookkeeping only — the guest gate
-- is ordering_active + (trial running OR account subscribed).
alter table public.accounts
  add column if not exists ordering_quantity integer not null default 0;

-- Request types that the menu makes redundant (Drinks / Coffee /
-- Dessert buttons) hide from the guest page while Ordering is live.
alter table public.request_types
  add column if not exists orderable boolean not null default false;

update public.request_types
   set orderable = true
 where kind = 'signal'
   and closes_session = false
   and (
     lower(coalesce(code, '')) in
       ('drinks','drink','wine','bar','cocktail','coffee','espresso','tea',
        'cake','dessert','desserts','menu','food','order','dessert_menu')
     or lower(coalesce(icon, '')) in ('wine','coffee','cake','menu')
   );

-- ---------------------------------------------------------------
-- 2. Menu tables
-- ---------------------------------------------------------------

create table if not exists public.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  name        jsonb not null default '{}'::jsonb,
  station     text  not null default 'kitchen' check (station in ('kitchen','bar')),
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists menu_categories_venue_idx
  on public.menu_categories (venue_id, active, sort_order);

create table if not exists public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  category_id  uuid not null references public.menu_categories(id) on delete cascade,
  name         jsonb not null default '{}'::jsonb,
  description  jsonb not null default '{}'::jsonb,
  price_cents  integer not null check (price_cents >= 0 and price_cents <= 1000000),
  -- 'stock:<key>' for a built-in illustration, or a full URL for an
  -- uploaded photo. Null = no photo.
  photo        text,
  -- EU-14 allergen codes plus dietary flags (see lib/menu/allergens).
  allergens    text[] not null default '{}',
  available    boolean not null default true,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists menu_items_venue_idx
  on public.menu_items (venue_id, active, sort_order);
create index if not exists menu_items_category_idx
  on public.menu_items (category_id);

create table if not exists public.menu_item_options (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.menu_items(id) on delete cascade,
  venue_id        uuid not null references public.venues(id) on delete cascade,
  name            jsonb not null default '{}'::jsonb,
  surcharge_cents integer not null default 0 check (surcharge_cents >= 0 and surcharge_cents <= 100000),
  sort_order      integer not null default 0,
  active          boolean not null default true
);

create index if not exists menu_item_options_item_idx
  on public.menu_item_options (item_id, active, sort_order);

-- ---------------------------------------------------------------
-- 3. Orders, station tickets, order lines
-- ---------------------------------------------------------------

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues(id) on delete cascade,
  session_id     uuid not null references public.sessions(id) on delete cascade,
  table_id       uuid not null references public.tables(id) on delete cascade,
  tag_id         text,
  -- The floor request that represents this order to waiters.
  request_id     uuid references public.requests(id) on delete set null,
  state          text not null default 'open' check (state in ('open','delivered','cancelled')),
  note           text,
  subtotal_cents integer not null default 0,
  service_pct    numeric(4,1) not null default 0,
  service_cents  integer not null default 0,
  total_cents    integer not null default 0,
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);

create index if not exists orders_venue_idx
  on public.orders (venue_id, state, created_at);
create index if not exists orders_request_idx
  on public.orders (request_id);
create index if not exists orders_session_idx
  on public.orders (session_id);

create table if not exists public.order_tickets (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  venue_id     uuid not null references public.venues(id) on delete cascade,
  station      text not null check (station in ('kitchen','bar')),
  state        text not null default 'new'
               check (state in ('new','preparing','ready','delivered','cancelled')),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  ready_at     timestamptz,
  delivered_at timestamptz,
  started_by   uuid,
  ready_by     uuid,
  delivered_by uuid
);

create index if not exists order_tickets_venue_idx
  on public.order_tickets (venue_id, state, created_at);
create index if not exists order_tickets_order_idx
  on public.order_tickets (order_id);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  ticket_id        uuid not null references public.order_tickets(id) on delete cascade,
  venue_id         uuid not null references public.venues(id) on delete cascade,
  menu_item_id     uuid references public.menu_items(id) on delete set null,
  -- Snapshots: the guest pays what the menu said at order time, even
  -- if the owner edits prices a minute later.
  name             jsonb not null default '{}'::jsonb,
  unit_price_cents integer not null default 0,
  -- [{ "name": {...locale map...}, "surcharge_cents": 100 }, ...]
  options          jsonb not null default '[]'::jsonb,
  quantity         integer not null default 1 check (quantity >= 1 and quantity <= 99),
  line_total_cents integer not null default 0,
  position         integer not null default 0
);

create index if not exists order_items_order_idx
  on public.order_items (order_id, position);
create index if not exists order_items_ticket_idx
  on public.order_items (ticket_id);

-- ---------------------------------------------------------------
-- 4. RLS — staff can read their venue's menu + orders (the write
--    paths all run through the API with the service role after an
--    owner/manager check, same as tags).
-- ---------------------------------------------------------------

alter table public.menu_categories    enable row level security;
alter table public.menu_items         enable row level security;
alter table public.menu_item_options  enable row level security;
alter table public.orders             enable row level security;
alter table public.order_tickets      enable row level security;
alter table public.order_items        enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'menu_categories' and policyname = 'staff_read_menu_categories') then
    create policy staff_read_menu_categories on public.menu_categories
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = menu_categories.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'menu_items' and policyname = 'staff_read_menu_items') then
    create policy staff_read_menu_items on public.menu_items
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = menu_items.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'menu_item_options' and policyname = 'staff_read_menu_item_options') then
    create policy staff_read_menu_item_options on public.menu_item_options
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = menu_item_options.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'orders' and policyname = 'staff_read_orders') then
    create policy staff_read_orders on public.orders
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = orders.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'order_tickets' and policyname = 'staff_read_order_tickets') then
    create policy staff_read_order_tickets on public.order_tickets
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = order_tickets.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'order_items' and policyname = 'staff_read_order_items') then
    create policy staff_read_order_items on public.order_items
      for select using (exists (
        select 1 from public.staff s
         where s.venue_id = order_items.venue_id
           and s.user_id = auth.uid() and s.active));
  end if;
end $$;

-- ---------------------------------------------------------------
-- 5. Realtime — the Orders board and the floor bell follow ticket
--    changes; the floor already follows requests.
-- ---------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and tablename = 'order_tickets') then
      alter publication supabase_realtime add table public.order_tickets;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------
-- 6. The transactional order insert.
--
-- Called by the API with the SERVICE ROLE after full validation and
-- price re-computation server-side. One transaction: order + tickets
-- + items + the floor request. Either everything lands or nothing.
-- ---------------------------------------------------------------

create or replace function public.guest_place_order(
  p_venue_id   uuid,
  p_session_id uuid,
  p_table_id   uuid,
  p_tag_id     text,
  p_note       text,
  p_service_pct numeric,
  -- [{ "station":"kitchen", "items":[{ "menu_item_id":"...","name":{...},
  --    "unit_price_cents":1450,"options":[{"name":{...},"surcharge_cents":100}],
  --    "quantity":1,"line_total_cents":1550 }] }, ...]
  p_tickets    jsonb
)
returns table (order_id uuid, request_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id       uuid;
  v_request_id     uuid;
  v_request_type   uuid;
  v_ticket         jsonb;
  v_item           jsonb;
  v_ticket_id      uuid;
  v_subtotal       integer := 0;
  v_service        integer;
  v_position       integer := 0;
begin
  -- Find (or create) the hidden request type that represents orders
  -- on the waiter's floor. active=false keeps it off the guest page's
  -- request buttons; the floor shows requests regardless.
  select rt.id into v_request_type
    from public.request_types rt
   where rt.venue_id = p_venue_id and rt.code = 'food_order'
   limit 1;

  if v_request_type is null then
    insert into public.request_types
      (venue_id, code, kind, label, sublabel, icon, closes_session, sort_order, active)
    values (
      p_venue_id, 'food_order', 'order',
      '{"en":"Order","es":"Pedido","da":"Bestilling","sv":"Beställning","no":"Bestilling","de":"Bestellung","nl":"Bestelling","fr":"Commande"}'::jsonb,
      '{}'::jsonb, 'menu', false, 999, false
    )
    returning id into v_request_type;
  end if;

  -- Subtotal from the (server-computed) line totals.
  for v_ticket in select * from jsonb_array_elements(p_tickets) loop
    for v_item in select * from jsonb_array_elements(v_ticket->'items') loop
      v_subtotal := v_subtotal + coalesce((v_item->>'line_total_cents')::integer, 0);
    end loop;
  end loop;

  v_service := round(v_subtotal * coalesce(p_service_pct, 0) / 100.0);

  -- The floor request first (the order row references it).
  insert into public.requests
    (venue_id, session_id, table_id, tag_id, request_type_id, state, note)
  values
    (p_venue_id, p_session_id, p_table_id, p_tag_id, v_request_type, 'open',
     nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_request_id;

  insert into public.orders
    (venue_id, session_id, table_id, tag_id, request_id, note,
     subtotal_cents, service_pct, service_cents, total_cents)
  values
    (p_venue_id, p_session_id, p_table_id, p_tag_id, v_request_id,
     nullif(trim(coalesce(p_note, '')), ''),
     v_subtotal, coalesce(p_service_pct, 0), v_service, v_subtotal + v_service)
  returning id into v_order_id;

  for v_ticket in select * from jsonb_array_elements(p_tickets) loop
    insert into public.order_tickets (order_id, venue_id, station)
    values (v_order_id, p_venue_id, v_ticket->>'station')
    returning id into v_ticket_id;

    for v_item in select * from jsonb_array_elements(v_ticket->'items') loop
      v_position := v_position + 1;
      insert into public.order_items
        (order_id, ticket_id, venue_id, menu_item_id, name, unit_price_cents,
         options, quantity, line_total_cents, position)
      values
        (v_order_id, v_ticket_id, p_venue_id,
         nullif(v_item->>'menu_item_id', '')::uuid,
         coalesce(v_item->'name', '{}'::jsonb),
         coalesce((v_item->>'unit_price_cents')::integer, 0),
         coalesce(v_item->'options', '[]'::jsonb),
         coalesce((v_item->>'quantity')::integer, 1),
         coalesce((v_item->>'line_total_cents')::integer, 0),
         v_position);
    end loop;
  end loop;

  return query select v_order_id, v_request_id;
end;
$$;

revoke all on function public.guest_place_order(uuid, uuid, uuid, text, text, numeric, jsonb) from public, anon, authenticated;
-- Revoking from PUBLIC also strips the implicit grant the service role
-- relied on — hand it back explicitly, or the API cannot place orders.
grant execute on function public.guest_place_order(uuid, uuid, uuid, text, text, numeric, jsonb) to service_role;

-- ---------------------------------------------------------------
-- 7. Storage bucket for uploaded dish photos (public read).
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;
