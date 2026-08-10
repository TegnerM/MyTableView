-- ============================================================
-- Guest options — 2026-08-10
--
-- 1. request_types.meta: per-button configuration. Today it holds
--    the taxi button's suggested pickup time ({"etaMinutes": 10});
--    tomorrow whatever another button needs.
-- 2. Backfill the three new hotel buttons (extra coffee/tea, book a
--    table for dinner, book a taxi) onto EXISTING hotel venues.
--    New hotels get them from the seed list in code; this reaches
--    the hotels created before today. Insert-if-missing by code —
--    never duplicates, never touches customized rows.
--
-- Safe to run more than once.
-- ============================================================

alter table public.request_types
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Existing hotels: move the built-ins to their new positions so the
-- new buttons slot in without sort-order ties (maintenance 65→66,
-- concierge 66→69, late check-out 67→70 — matching the code seeds).
-- Guarded by the old value, so customized orders are left alone.
update public.request_types
   set sort_order = 66
 where code = 'hotel_maintenance' and sort_order = 65;

update public.request_types
   set sort_order = 69
 where code = 'hotel_concierge' and sort_order = 66;

update public.request_types
   set sort_order = 70
 where code = 'hotel_late_checkout' and sort_order = 67;

-- Extra coffee, tea, sugar & milk (housekeeping group)
insert into public.request_types
  (venue_id, code, kind, label, sublabel, icon, closes_session, sort_order, active)
select
  v.id, 'hotel_hk_coffee', 'signal',
  '{"en":"Extra coffee, tea, sugar & milk","es":"Más café, té, azúcar y leche","da":"Mere kaffe, te, sukker og mælk","sv":"Mer kaffe, te, socker och mjölk","no":"Mer kaffe, te, sukker og melk","de":"Mehr Kaffee, Tee, Zucker & Milch","nl":"Extra koffie, thee, suiker en melk","fr":"Plus de café, thé, sucre et lait"}'::jsonb,
  '{"en":"Refill the room tray","es":"Reponer la bandeja de la habitación","da":"Genopfyld bakken på værelset","sv":"Fyll på rummets bricka","no":"Etterfyll brettet på rommet","de":"Das Zimmertablett auffüllen","nl":"Het blad op de kamer aanvullen","fr":"Recharger le plateau de la chambre"}'::jsonb,
  'coffee', false, 65, true
from public.venues v
where v.edition = 'hotel'
  and not exists (
    select 1 from public.request_types rt
     where rt.venue_id = v.id and rt.code = 'hotel_hk_coffee'
  );

-- Book a table for dinner (service group)
insert into public.request_types
  (venue_id, code, kind, label, sublabel, icon, closes_session, sort_order, active)
select
  v.id, 'hotel_book_table', 'signal',
  '{"en":"Book a table for dinner","es":"Reservar mesa para cenar","da":"Book et bord til middag","sv":"Boka bord till middag","no":"Bestill bord til middag","de":"Tisch zum Abendessen reservieren","nl":"Tafel reserveren voor het diner","fr":"Réserver une table pour le dîner"}'::jsonb,
  '{"en":"At the hotel restaurant","es":"En el restaurante del hotel","da":"På hotellets restaurant","sv":"På hotellets restaurang","no":"På hotellets restaurant","de":"Im Hotelrestaurant","nl":"In het hotelrestaurant","fr":"Au restaurant de l''hôtel"}'::jsonb,
  'wine', false, 67, true
from public.venues v
where v.edition = 'hotel'
  and not exists (
    select 1 from public.request_types rt
     where rt.venue_id = v.id and rt.code = 'hotel_book_table'
  );

-- Book a taxi (service group; the hotel sets the suggested pickup
-- time in Settings — stored in meta.etaMinutes)
insert into public.request_types
  (venue_id, code, kind, label, sublabel, icon, closes_session, sort_order, active)
select
  v.id, 'hotel_taxi', 'signal',
  '{"en":"Book a taxi","es":"Pedir un taxi","da":"Bestil en taxa","sv":"Boka en taxi","no":"Bestill en taxi","de":"Ein Taxi bestellen","nl":"Een taxi boeken","fr":"Réserver un taxi"}'::jsonb,
  '{"en":"We''ll send one to the entrance","es":"Lo enviamos a la entrada","da":"Vi sender en til indgangen","sv":"Vi skickar en till entrén","no":"Vi sender en til inngangen","de":"Wir schicken eins zum Eingang","nl":"We sturen er een naar de ingang","fr":"Nous l''envoyons à l''entrée"}'::jsonb,
  'taxi', false, 68, true
from public.venues v
where v.edition = 'hotel'
  and not exists (
    select 1 from public.request_types rt
     where rt.venue_id = v.id and rt.code = 'hotel_taxi'
  );
