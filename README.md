# Pemart

Mobile-first store for Pemart (faith-inspired merch and gifts). Next.js 15 on Vercel, Supabase (Postgres, Auth, Storage), Paystack for Naira payments.

> Full setup, Paystack live switch, Resend and deployment steps are completed in Phase 7. Progress and decisions are in [PROGRESS.md](./PROGRESS.md).

## Run locally

```bash
npm install
cp .env.example .env.local     # optional in Phase 1: the shell runs without Supabase
npm run dev                    # http://localhost:3000
npm run test
```

## Database

Migrations live in `supabase/migrations` (run in order) and demo content in `supabase/seed.sql`.

**Local Postgres (no Supabase needed):**

```bash
npm run db:local
su postgres -c "psql -d pemart_local -f supabase/tests/verify.sql"
```

**Your Supabase project:** in the SQL editor (or with the Supabase CLI `supabase db push`) apply the files in `supabase/migrations/` in order, then `supabase/seed.sql`. Do not run `supabase/local-stub.sql`: it only fakes Supabase for local testing. After signing in once, make yourself admin with `supabase/make-admin.sql`.

The storefront reads the catalogue from Supabase when configured, otherwise from `lib/catalogue/fixture.json` (so it runs with no backend). Refresh the fixture after changing seed data: `npm run db:local && npm run db:fixture`.

Regenerate design artwork and the seed: `npm run gen:art && bash scripts/build-seed.sh`.

## Roles

`customer` (default), `staff` (orders, proofs, quotes, reviews), `admin` (everything). Checked on the server and again by RLS.

## Local development with a database (checkout, orders, emails)

The storefront runs with no backend. To exercise the real checkout locally, use a plain Postgres 15+ instead of Supabase:

```bash
npm run db:local          # builds database `pemart_local` from the migrations + seed
npm run db:fixture        # exports the catalogue so the app uses the SAME ids as that database
rm -rf .next              # Next caches the old catalogue on disk after a reseed
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pemart_local PAYSTACK_MOCK=1 \
PAYSTACK_SECRET_KEY=sk_test_local CRON_SECRET=local npm run dev
```

With `PAYSTACK_MOCK=1` the payment popup is a clearly labelled simulation. Both settings are refused when `NODE_ENV=production`, so they can never leak into a real deployment. Emails are written to `./.outbox/*.html` when `RESEND_API_KEY` is not set.

## Tests

```bash
npm test                  # unit tests (pricing engine, bundles, studio, Paystack signature, ...)
npm run test:db           # integration tests against real Postgres (stock, idempotency, expiry, webhook route)
                          # needs a local Postgres; TEST_DB_URL=postgres://user:pass@localhost:5432 if not the default
```

## How a payment works (so you can trust it)

1. The browser sends **what is in the bag** (ids and choices). Never a price.
2. The server re-prices everything from the database (`lib/checkout/pricing.ts`), then one SQL function creates the order, holds stock, and records the payment reference, all in a single transaction.
3. The server starts the Paystack transaction for the amount **it** calculated and hands the popup an access code.
4. After the popup, the server asks Paystack whether the payment really succeeded, and the database checks the amount and currency match the order before marking it paid.
5. Paystack's webhook (`/api/webhooks/paystack`, HMAC-SHA512 signature checked) does the same job. Whichever arrives first wins, and the other changes nothing.
6. Orders unpaid after 24 hours are cancelled hourly (`/api/cron/expire`) and their stock, store credit and gift card balance are released.

## Accounts, proofs and the sign-in email

- **Sign-in email:** Supabase Auth sends the magic-link email. To use Pemart's branding, render `emails/sign-in-link.tsx` and paste the HTML into Supabase > Authentication > Email Templates > Magic Link, replacing the link with `{{ .ConfirmationURL }}`.
- **Making yourself admin:** sign in once, then run `supabase/make-admin.sql` in the Supabase SQL editor. Add staff the same way with `role = 'staff'`.
- **Local login without Supabase:** with `DATABASE_URL` set (local Postgres mode), `/api/dev/login?email=you@example.com&role=admin&next=/admin` signs you in. It does not exist in production.
- **Cron jobs** (`vercel.json`): `/api/cron/expire` (cancels unpaid orders after 24 hours) and `/api/cron/reminders` (abandoned-checkout email, review requests). Both need `CRON_SECRET`. Hourly schedules need Vercel Pro; on Hobby change them to daily.

## Admin

Open `/admin` after signing in as an admin or staff user (see "Making yourself admin" above). `/admin/help` is the owner's guide.

- **Staff** can run operations: orders, production board, proofs, bulk quotes, reviews, customers. **Admins** can also edit the catalogue, discounts and ambassadors, reports and settings.
- Proof images, product photos and the logo upload to private/public Supabase buckets through short-lived signed URLs. In local Postgres mode they are saved to `public/uploads` (git-ignored).
- Changes to the catalogue and settings reach the store within about five minutes (the store caches them) and immediately in local mode.
- Testing the admin locally: `/api/dev/login?email=staff@example.com&role=staff&next=/admin` (or `role=admin`).
