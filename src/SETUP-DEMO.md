# The permanent demo venues

Three hard-wired demo venues live on the production Supabase project so
anyone presenting MyTableView always has something real to show:

| Venue           | Edition    | What it shows                                        |
|-----------------|------------|------------------------------------------------------|
| Demo Restaurant | restaurant | Dining room + terrace, full menu, live floor at mid-service |
| Demo Bar        | bar        | Bar floor + beer garden, cocktails menu, tab buttons |
| Demo Hotel      | hotel      | Two room floors, room service, housekeeping + taxi   |

All three belong to one demo owner account, so a single login shows the
multi-venue switcher too.

## Creating / refreshing

```
npm run seed:demo
```

Reads `.env.local` (same file the app uses — needs
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`).

- **First run** creates everything: owner, venues, zones, tables, NFC
  tags, menus.
- **Every run** re-stages the LIVE data — open sessions, a couple of
  guest requests (one escalated red table), a bill request, and a food
  order with kitchen/bar tickets — after wiping the previous live
  state. Run it right before a presentation so the floor always opens
  on the same believable mid-service moment.
- Static data is only created when missing, so a re-run never
  duplicates venues, tables or menu items, and it won't overwrite
  tweaks a presenter made in the UI. (If a demo venue gets truly
  mangled, delete it in Supabase and re-run.)

The demo owner's password is re-applied on every run, so the printed
credentials always work.

## Environment overrides

| Variable        | Default                    | Purpose                       |
|-----------------|----------------------------|-------------------------------|
| `DEMO_EMAIL`    | `demo@mytableview.com`     | Demo owner login              |
| `DEMO_PASSWORD` | `DemoTable!2026`           | Demo owner password (set your own!) |
| `DEMO_BASE_URL` | `https://mytableview.com`  | Base for the printed guest links |

## Presenting

1. Sign in at `/staff/sign-in` with the demo credentials the script
   prints. Switch between the three venues in the staff navigation.
2. Open one of the printed guest links (`/t/<tagId>`) on a phone — that
   is the guest side of the same table; requests and orders you place
   there appear live on the floor.
3. To let a prospect try it themselves, either share the demo login or
   invite their email from **Settings → Team** (waiter or manager) —
   the normal invite flow works because these are ordinary venues.

## Why they never expire

The venues' `trial_ends_at` is parked at 2099-01-01. Under
`lib/billing/status.ts` a running trial keeps a venue open regardless
of the account's billing status, so no Stripe subscription is needed
and the guest pages, ordering and staff floor all stay live. (The
billing card will show them as on-trial — that's expected.)

## Bar menu sharing ("Also on the bar menu")

Dishes on a full menu (restaurant/hotel edition) can be ticked
**Also on the bar menu** in the menu editor — they then appear on the
guest menu of the bar venue on the same account (same-property venues
win when names use the "<Property> — Bar" convention), and bar guests
can order them like any other dish. Requires the
`src/sql/2026-08-11_bar_menu_sharing.sql` migration (Supabase → SQL
Editor) and a deploy.

The seed ticks Garlic prawns and Crispy calamari on Demo Restaurant,
so Demo Bar's guest menu shows a "Starters" section coming from the
restaurant — that's the feature demo. Until the migration has run,
the seed prints a warning and skips this step.

## Notes

- The bar edition's two bill buttons meet the one-closer-per-venue
  constraint like this: the default "Bring the bill" closer is retired,
  `bar_bill_table` becomes the venue's closer, and `bar_bill_bar`
  is seeded as a plain signal button.
- The seed replicates the edition defaults from `src/lib/edition.ts`
  (stations, request buttons). If those defaults change, update
  `scripts/seed-demo.mjs` to match — or re-apply the edition from
  Settings → Venue type after seeding.
