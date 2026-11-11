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

Regenerate design artwork and the seed: `npm run gen:art && bash scripts/build-seed.sh`.

## Roles

`customer` (default), `staff` (orders, proofs, quotes, reviews), `admin` (everything). Checked on the server and again by RLS.
