# Signup + 14-day trial + Stripe — setup steps

Everything in code is done. These are the one-time steps only you can do
(they touch your Supabase project, your Stripe sandbox, and files outside
`src/`). Do them in order; ~15 minutes total.

## 1. Install the two new packages

From the project root (`mytableview-app`):

```bash
npm install stripe qrcode
npm install -D @types/qrcode
```

## 2. Run the database migration

Open **Supabase Dashboard → SQL Editor**, paste the whole of
`src/sql/2026-07-31_billing_and_signup.sql`, and run it.

What it does: billing columns on `venues` (new venues start a 14-day
trial automatically), your existing venue(s) are set to `active` so the
pilot is never locked, and a `signup_create_venue()` function that
signup calls to create venue + owner + starter zone + the three default
guest buttons in one transaction.

If any insert in the function errors about a column I couldn't see from
the app code (e.g. an extra NOT NULL field on `venues`), paste me the
error and I'll adjust the SQL.

## 3. Turn off email confirmation (recommended for now)

**Supabase Dashboard → Authentication → Sign In / Up → Email** — disable
"Confirm email".

Why: with confirmation on, a new restaurant can't reach the app until
they click the email link, which kills the "live tonight" flow. The
signup form handles both modes, but confirmation-off is the smooth path.
Revisit before serious scale (spam signups).

## 4. Stripe products — DONE (sandbox)

Created 2026-07-31. The app currently sells the single-restaurant plan
only; the multi-restaurant tiers are parked below until account-level
multi-venue billing is built (needs an "add venue" flow + tier
enforcement — the current model is one subscription per venue).

## 5. Environment variables

Add to `.env.local` (and later to your hosting provider's env settings):

```bash
STRIPE_SECRET_KEY=sk_test_...        # Stripe → Developers → API keys (sandbox)
STRIPE_WEBHOOK_SECRET=whsec_...      # from step 6
STRIPE_PRICE_MONTHLY=price_1TzBkBLz7mdUWO9SgTaKRsSU   # €49/month, 1 restaurant
STRIPE_PRICE_YEARLY=price_1TzBkaLz7mdUWO9SLSvyP9ky    # €490/year, 1 restaurant
NEXT_PUBLIC_SITE_URL=https://mytableview.com

# Parked for the future multi-venue tiers (not read by the app yet):
# monthly up to 3:  price_1TzBmPLz7mdUWO9SoOrM64Aa   (€99/mo)
# monthly up to 5:  price_1TzBneLz7mdUWO9SJ443Xxmy   (€149/mo)
# monthly up to 10: price_1TzBoaLz7mdUWO9SLhNgYL20   (€249/mo)
# yearly  up to 3:  price_1TzBqALz7mdUWO9SeH6ZEDW1   (€990/yr)
# yearly  up to 5:  price_1TzBr0Lz7mdUWO9Su8yVsljQ   (€1,490/yr)
# yearly  up to 10: price_1TzBsALz7mdUWO9StD8ry1mf   (€2,490/yr)
```

## 6. Webhook

Local testing (uses the [Stripe CLI](https://docs.stripe.com/stripe-cli)):

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

It prints a `whsec_...` — that's your `STRIPE_WEBHOOK_SECRET` for local dev.

For the deployed site: **Stripe Dashboard → Developers → Webhooks → Add
endpoint**, URL `https://mytableview.com/api/billing/webhook`, events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy that endpoint's signing secret into the deployed env as
`STRIPE_WEBHOOK_SECRET`.

## 7. Try the whole loop (sandbox)

1. Open `/staff/sign-up` → create a test restaurant → you land in the
   layout editor with a "Main floor" zone ready. Drag a few tables in.
2. Visit `/staff/qr` (also linked from Settings → Billing) → print/scan
   a QR with your phone → the guest page opens → tap "Drinks" → it lands
   on the floor. The restaurant is "live tonight".
3. Settings shows **Free trial — 14 days left**.
4. To test the lock without waiting two weeks, in the SQL editor:
   `update venues set trial_ends_at = now() - interval '1 day' where name = 'YOUR TEST VENUE';`
   → every staff page shows the lock screen; guest taps show "venue
   unavailable".
5. Click **Monthly** on the lock screen → Stripe Checkout → card
   `4242 4242 4242 4242`, any future expiry, any CVC → you return to
   Settings and (via the webhook) the venue flips to **Subscribed** and
   the floor is back.
6. **Manage billing** opens the Stripe portal; cancelling there flips
   the venue to locked once the period lapses — again via the webhook.

## What changed in the app

- `/staff/sign-up` — self-serve signup (linked from the landing page CTA
  and from sign-in). Creates the venue with the trial clock running.
- Trial gate on all four staff surfaces + guest taps stop when locked.
  `past_due` (failed renewal being retried) does NOT lock — a card
  hiccup must never kill a floor mid-service.
- Settings → Billing card: trial countdown, subscribe, manage, QR link.
- `/staff/qr` — printable per-table QR codes; assigns web tags to
  tables that lack one.
- Landing CTA is now "Start your free trial" → `/staff/sign-up`.

## Known follow-ups (not in this pass)

- Staff invites (owners add waiters themselves).
- Rate limiting on the guest tap endpoint.
- Trial-ending reminder emails (day 10, day 13).
- Multi-venue "add venue" for existing owners.
