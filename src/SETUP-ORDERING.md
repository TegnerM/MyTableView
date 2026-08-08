# Ordering module — setup steps

Everything in code is done. These are the one-time steps only you can
do. **Order matters: run the migration BEFORE deploying the new code**
— the floor and the guest page now read columns/tables the migration
creates, so new code against an un-migrated database will error.

## 1. Run the database migration (FIRST)

Supabase Dashboard → SQL Editor → paste the whole of
`src/sql/2026-08-08_ordering_module.sql` → run.

What it does: menu tables (categories / items / options), orders +
kitchen/bar tickets + order lines, `venues.ordering_active` +
`venues.service_charge_pct`, `accounts.ordering_quantity`, RLS read
policies for staff, realtime on tickets, the transactional
`guest_place_order()` function, the public `menu-photos` storage
bucket, and it marks your existing Drinks/Coffee/Dessert-style request
types as `orderable` (those buttons hide while the menu is live).

If the `request_types` insert inside `guest_place_order` ever errors
about a column I couldn't see from the app code, paste me the error
and I'll adjust.

## 2. Deploy the code

Push to main as usual (git commands are in the handover message).

## 3. Stripe — nothing to do 🎉

The €19/month (€190/year) add-on price is created automatically in
your Stripe account on first activation, via lookup keys
(`mtv_ordering_monthly` / `mtv_ordering_yearly`). Works in sandbox and
live. If you ever want to hand-manage the prices instead, create them
in the dashboard and set:

```bash
STRIPE_PRICE_ORDERING_MONTHLY=price_...
STRIPE_PRICE_ORDERING_YEARLY=price_...
```

## 3b. Automatic menu translation (recommended, 2 minutes)

The menu editor asks for ONE language — yours. The server translates
names, descriptions and options into the venue's other guest languages
automatically on every save. To switch that on, create a free DeepL
API account (500,000 characters/month free) and add:

```bash
DEEPL_API_KEY=xxxxxxxx-xxxx-...:fx
```

to `.env.local` and your hosting env. Without the key nothing breaks —
guests in other languages simply see the main language until the key
is added (re-save a dish to translate it).

## 3c. Spreadsheet import

The Menu page has an **Import spreadsheet** button (next to
"+ Add category"). It takes one or several .xlsx files in the menu
template format (Dish Name | Category | Default Description |
Allergens | Diet Tags | Restaurant Price | Active) — your 10 example
templates import as-is: categories are created automatically (drink
categories go to the Bar station), allergen/diet words are matched
tolerantly ("Gluten, Milk, vegetarian"), Yes/No maps to available, and
re-importing a corrected file UPDATES dishes instead of duplicating
them. Rows without a price import as sold-out at 0.00 € until priced.
If auto-translate is on, imported dishes translate in the same run.

Requires one new package — run once after pulling:

```bash
npm install
```

## 4. Try the whole loop (sandbox)

1. **Menu**: staff sidebar → Menu → add a category "Drinks" (station:
   Bar) and "Mains" (station: Kitchen) → add a couple of dishes with
   prices, a stock illustration or your own photo, allergens, and an
   option with a surcharge.
2. **Activate**: Settings → Ordering module → Activate. (On a trial
   venue it's free and instant; on a subscribed venue it's added to
   the subscription pro-rata. With no trial and no subscription it
   asks you to subscribe first.)
3. **Order as a guest**: scan a table QR → the guest page now shows
   "View menu & order" and hides the Drinks/Coffee/Dessert buttons →
   order a dish with options + a drink → cart shows the service line
   (set the % on the same Settings card) → place order.
4. **Watch it split**: /staff/orders on two devices — pick "Kitchen"
   on one, "Bar" on the other. Each sees only its ticket of that one
   order. Start → Ready.
5. **The bell**: on a device showing the floor, "Ready" rings a chime
   and shows a green banner; the table's order row shows the ready
   badge. (Browsers unlock audio after the first tap on the page — a
   freshly opened, untouched tab shows the banner silently.)
6. **Deliver**: waiter taps Done on the floor (or Delivered on the
   board) — the ticket, the order and the floor entry all clear
   together, whichever side acted.
7. **The clock**: Insights now has "Ordering — service clock": orders,
   kitchen/bar preparation averages, pickup average (ready→delivered),
   by hour. The pickup number turning red = food waiting on the pass.

## Billing model (what the code enforces)

- Per restaurant: €19/mo (or €190/yr on yearly accounts), as ONE
  subscription item whose quantity = number of your restaurants with
  Ordering on and past their trial. One invoice, one portal.
- Free during each venue's own 14-day trial. When a trial lapses on a
  subscribed account, the daily cron picks the venue up and adjusts
  the Stripe quantity (same cron as the trial-reminder emails).
- Cancelling the whole subscription switches ordering off gracefully:
  menus stay saved, the guest page simply drops the menu card.
- The guest-facing gate never depends on the Stripe sync being
  current — a Stripe hiccup can't kill a live menu mid-service.

## Notes

- Stock photos are the built-in illustrated set in
  `/public/menu-stock/*.svg` — drop real JPG/PNGs with the same names
  there anytime to replace them globally; owners can also upload a
  photo per dish (menu-photos bucket, 5 MB cap).
- The kitchen/bar iPads sign in as normal staff (waiter role is
  fine), open Orders, pick their station once — remembered per device.
- Guest status bar ("Table 1 · Terrace-Zone 1 …") no longer truncates
  — same fix as the mockup you approved.

---

# Bar edition — setup steps (added 2026-08-09)

## 1. Run the bar-edition migration (FIRST, before deploying)

Supabase Dashboard → SQL Editor → paste the whole of
`src/sql/2026-08-09_bar_edition.sql` → run.

What it does: `venues.edition` (default `restaurant`), the `stations`
table (per-venue station names — the engine every edition rides on),
seeds Kitchen/Bar stations for all existing venues, and loosens the
old fixed station checks so future editions can add their own.

## 2. Deploy the code

Push to main as usual.

## 3. Switch a venue to Bar

Settings → **Venue type** → Bar (owner only, instant, reversible).

What changes when you switch:
- The guest page becomes the dark bar experience you approved:
  Order drinks · Another round · Snacks · Call staff · Ask for the
  bill, plus the live order-status chip and timeline (real
  timestamps, never estimates).
- The kitchen station is renamed "Snack kitchen" on the staff
  boards (slug stays `kitchen` — no data moves).
- Bar request buttons are seeded once if missing: More napkins,
  Clean the table, Bring the bill, We'll pay at the bar.
- Insights gains "Rounds per guest" and "Busiest areas".

Switching back to Restaurant restores names and the warm guest page;
nothing is deleted either way.
