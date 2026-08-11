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
