-- ============================================================
-- Bar menu sharing — "Also on the bar menu". 2026-08-11.
--
-- A venue with a full menu (restaurant/hotel edition) can tick a
-- dish so it ALSO appears on the guest menu of the bar venue on the
-- same account. The tick lives on the dish; the link is resolved by
-- account (same-property venues win) in lib/menu/bar-share.ts.
--
-- Paste the whole file into Supabase Dashboard → SQL Editor.
-- Safe to re-run.
-- ============================================================

alter table public.menu_items
  add column if not exists also_on_bar boolean not null default false;

comment on column public.menu_items.also_on_bar is
  'Published onto the linked bar venue''s guest menu ("Also on the '
  'bar menu" in the editor). Only meaningful on full-menu venues; '
  'resolved account-wide in lib/menu/bar-share.ts.';

-- The bar's guest menu asks: "shared items on my source venues" —
-- keep that read off the sequential scan.
create index if not exists menu_items_bar_share_idx
  on public.menu_items (venue_id, also_on_bar)
  where also_on_bar;

-- ---------------------------------------------------------------
-- Backfill: the orderable flag (buttons the live menu makes
-- redundant — Drinks / Coffee / Dessert). The 2026-08-08 migration
-- stamped it for venues that existed then; signup does not stamp
-- it, so venues created since have shown redundant buttons next to
-- a live menu. Same rule, re-runnable, catches them all.
-- ---------------------------------------------------------------

update public.request_types
   set orderable = true
 where kind = 'signal'
   and closes_session = false
   and orderable = false
   -- edition buttons are real services, never menu duplicates
   and code not like 'hotel\_%'
   and code not like 'bar\_%'
   and (
     lower(coalesce(code, '')) in
       ('drinks','drink','wine','bar','cocktail','coffee','espresso','tea',
        'cake','dessert','desserts','menu','food','order','dessert_menu')
     or lower(coalesce(icon, '')) in ('wine','coffee','cake','menu')
   );
