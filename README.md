# Pemart

Mobile-first store for Pemart (faith-inspired merch and gifts): Next.js 15 (App Router, TypeScript), Tailwind, Supabase (Postgres, Auth, Storage), Paystack (NGN), Resend. Deploys to Vercel.

Progress, decisions and the acceptance-test table are in [PROGRESS.md](./PROGRESS.md). Before you go live, work through [LAUNCH.md](./LAUNCH.md).

## Contents

1. [Run it locally](#1-run-it-locally)
2. [Set up Supabase](#2-set-up-supabase)
3. [Paystack: test keys, then live](#3-paystack-test-keys-then-live)
4. [Resend: email and your domain](#4-resend-email-and-your-domain)
5. [Analytics and cookie consent](#5-analytics-and-cookie-consent)
6. [Deploy to Vercel](#6-deploy-to-vercel)
7. [Day-to-day: add products, bundles, designs](#7-day-to-day-add-products-bundles-designs)
8. [Testing](#8-testing)
9. [How things work](#9-how-things-work)
10. [Environment variables](#10-environment-variables)

## 1. Run it locally

You need Node 20+. The site runs with **no backend at all** (it falls back to bundled demo data), which is enough to look around.

```bash
npm install
cp .env.example .env.local     # optional for a first look
npm run dev                    # http://localhost:3000
```

To try the real checkout, orders, proofs, emails and the admin on your own machine, use a plain local Postgres 15+ instead of Supabase:

```bash
npm run db:local               # builds database `pemart_local` from the migrations + seed
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pemart_local \
PAYSTACK_MOCK=1 PAYSTACK_SECRET_KEY=sk_test_local CRON_SECRET=local npm run dev
```

- `PAYSTACK_MOCK=1` turns the payment popup into a clearly labelled simulation (no Paystack account needed). It, `DATABASE_URL` and the dev login are all **refused when `NODE_ENV=production`**, so they can never leak into a live deployment.
- Emails are written to `./.outbox/*.html` when `RESEND_API_KEY` is not set.
- Sign in without email: `/api/dev/login?email=you@example.com&role=admin&next=/admin` (roles: `customer`, `staff`, `admin`). It does not exist in production.

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick a region close to Lagos (e.g. London or Frankfurt).
2. **Database (easiest).** Open *SQL editor > New query*, paste the whole of `supabase/setup-all.sql` (all migrations plus the demo seed in one file; rebuild it any time with `bash scripts/build-supabase-setup.sh`) and press Run. Use an empty project and run it once. Or, in pieces: run, every file in `supabase/migrations/` (`0001` to `0013`), then `supabase/seed.sql` (demo products, bundles, delivery zones, settings). With the Supabase CLI: `supabase link --project-ref <ref> && supabase db push`, then run `supabase/seed.sql`. Do **not** run `supabase/local-stub.sql`; it only fakes Supabase locally.
3. **Storage.** Migration `0008` creates the buckets: `product-images` and `review-photos` (public) and `design-uploads`, `proofs`, `print-artwork` and `bulk-uploads` (private). Nothing to do unless the SQL reported an error.
4. **Auth.** *Authentication > URL configuration*: set **Site URL** to your live domain and add `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` to **Redirect URLs**. Customers sign in with email + password or Google. Under *Authentication > Providers > Email* decide whether **Confirm email** is on (recommended; they must click a link once) and under *Emails > Templates* brand the Confirm signup and Reset password emails. For "Continue with Google", enable the Google provider and paste a Google OAuth client ID and secret. To brand the sign-in email, render `emails/sign-in-link.tsx` and paste the HTML into *Authentication > Email Templates > Magic Link* (keep `{{ .ConfirmationURL }}`).
5. **Keys.** *Project settings > API*: copy the Project URL, the `anon` key and the `service_role` key into your environment (section 10). The service role key is server-only; never put it in a `NEXT_PUBLIC_` variable.
6. **Make yourself admin.** Sign in once on the site, then run `supabase/make-admin.sql` in the SQL editor with your email. Add staff the same way with `role = 'staff'`.
7. **Check security.** In the dashboard open *Advisors* and confirm there are no "RLS disabled" warnings. Every table has row level security; money and admin work happens in `SECURITY DEFINER` functions that only the service role can call.

Refresh the bundled demo data after changing seeds: `npm run db:local && npm run db:fixture`. Regenerate the design artwork and seed: `npm run gen:art && bash scripts/build-seed.sh`.

## 3. Paystack: test keys, then live

**Test mode (start here).**

1. Create a [Paystack](https://paystack.com) account. In *Settings > API Keys & Webhooks*, switch the dashboard to **Test mode**.
2. Set `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...` and `PAYSTACK_SECRET_KEY=sk_test_...`.
3. Set the **Test Webhook URL** to `https://YOUR-DOMAIN/api/webhooks/paystack` (use your Vercel preview or production URL; Paystack must be able to reach it).
4. Pay with a [Paystack test card](https://paystack.com/docs/payments/test-payments/), for example `4084 0840 8408 4081`, any future expiry, CVV `408`, OTP `123456`.
5. Check that the order becomes **Paid** in `/admin/orders`, the confirmation email arrives, and stock drops.

**Going live.**

1. Complete Paystack business verification so live payments and settlements are enabled.
2. Switch the dashboard to **Live mode**, copy the live keys, and set `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...` and `PAYSTACK_SECRET_KEY=sk_live_...` in Vercel **Production** environment variables.
3. Set the **Live Webhook URL** to `https://YOUR-DOMAIN/api/webhooks/paystack` (live and test have separate webhook settings).
4. **Redeploy.** `NEXT_PUBLIC_*` values are baked in at build time.
5. Make one small real purchase, confirm it in the admin and in Paystack, then refund it from the Paystack dashboard.
6. `PAYSTACK_MOCK` must **not** be set in production (the app refuses to start a mock payment there).

The browser never decides a price. The server recalculates everything, and the webhook (HMAC-SHA512 signature checked) and the return-from-popup check both go through one idempotent database function, so a payment can only ever mark an order paid once.

## 4. Resend: email and your domain

1. Create a [Resend](https://resend.com) account and an API key; set `RESEND_API_KEY`.
2. *Domains > Add domain* (use a subdomain such as `mail.yourdomain.com`). Add the DNS records Resend shows (SPF, DKIM, optionally DMARC) at your DNS provider and wait for **Verified**.
3. Set `EMAIL_FROM="Pemart <orders@mail.yourdomain.com>"` (must be on the verified domain) and `ADMIN_NOTIFY_EMAIL` (where new bulk-quote alerts go).
4. Test: place a test order. The customer gets the confirmation; the order page shows the proof and status links. Until the domain is verified, Resend only delivers to your own address.
5. Supabase sign-in emails are sent by Supabase, not Resend. For production volume, add your Resend SMTP details in *Supabase > Authentication > SMTP settings* so those emails also come from your domain.

Emails that are sent: order confirmation, proof ready, proof approved, order status updates (including "in production" and "out for delivery"), review request, abandoned checkout, gift cards, bulk quote received/ready, and the first-order welcome code.

## 5. Analytics and cookie consent

**The cookie banner is off by default**, so with nothing else set no analytics run at all. To turn it on, set `NEXT_PUBLIC_COOKIE_BANNER=1` and redeploy. Then nothing but essential storage (bag, sign-in) runs until a visitor chooses in the banner. "Cookie settings" in the footer re-opens it, and withdrawing consent switches tracking off.

| Tool | Variable | Category | Events |
| --- | --- | --- | --- |
| Google Analytics 4 | `NEXT_PUBLIC_GA_ID` (`G-XXXXXXX`) | Analytics | `view_item`, `add_to_cart`, `begin_checkout`, `purchase` |
| Vercel Analytics | none (enable *Analytics* on the Vercel project) | Analytics | page views + the same events |
| Meta Pixel | `NEXT_PUBLIC_META_PIXEL_ID` | Marketing | `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase` |

Leave a variable empty to switch that tool off. Values are in naira (NGN). `purchase` fires once per order per device, using the order number as the transaction id so Meta and GA can de-duplicate. The consent choice is stored with a timestamp in the visitor's browser.

## 6. Deploy to Vercel

1. Push the repository to GitHub and *Import project* in Vercel (framework: Next.js; build and output defaults are right).
2. Add the environment variables from section 10 for **Production** (and **Preview** if you want previews to work, using test keys).
3. Set `NEXT_PUBLIC_SITE_URL` to your final `https://` domain (used for canonical URLs, sitemap, emails and Paystack callbacks). Add your domain under *Settings > Domains*.
4. **Cron jobs** are defined in `vercel.json`: `/api/cron/expire` (cancels unpaid orders after 24 hours, hourly) and `/api/cron/reminders` (abandoned-checkout and review-request emails, hourly). Set `CRON_SECRET`; Vercel sends it as a Bearer token. `vercel.json` ships with **daily** schedules (02:00 and 09:00 UTC) because Vercel's free Hobby plan rejects anything more frequent and the build fails. On the Pro plan you can change them to hourly (`0 * * * *` and `30 * * * *`). With daily runs an unpaid order can be held up to about 48 hours instead of 24 and reminder emails go out once a day.
5. Deploy, then run through [LAUNCH.md](./LAUNCH.md).

Notes: pages that show the catalogue are cached and refreshed the moment an admin saves a change (tag revalidation), so there is nothing to rebuild when you edit products or settings. Rate limiting is in-memory per server instance (see LAUNCH.md for the upgrade path).

## 7. Day-to-day: add products, bundles, designs

Everything below is in the admin at `/admin` (admins only; staff see orders, production, proofs, quotes, reviews and customers). `/admin/help` is the owner's guide.

- **Add a product:** *Catalogue > New product*. Give it a name, URL slug and base price, then *Create*. On its page: fill in the description, choose the collection and type, then use **Generate variants** to create every colour/size combination in one go (e.g. colours "Black, Sand" and sizes "S, M, L" makes six). Set stock per variant, add photos (each needs alt text), tick *Active* and save. It appears on the store immediately. Tees and hoodies can show a design mockup; other products use their photos.
- **Add a design:** designs (the artwork on tees, hoodies and frames) are linked to a product on its edit page. Upload artwork as SVG or PNG; the mockup places it in the print area.
- **Add or edit a bundle:** *Catalogue > Bundles*. A bundle has a name, price, optional Christmas availability window, and **slots** (for example "His tee", "Her perfume"). Each slot says which product type it accepts; the customer picks the product, colour, size and option in the bundle builder, and the order records every choice. Change the price, slots or dates and save; the bundle page updates at once.
- **Discount codes and ambassadors:** *Discounts*. Percentage or fixed, optional minimum spend, date range and usage limits. An ambassador gets a personal 10% code and earns a commission recorded on each paid order.
- **Delivery, Christmas cutoffs, announcement bar, WhatsApp number, gift wrap/express fees, maintenance mode:** *Settings*.
- **Logo:** *Settings > Logo*. Upload it there; no code change needed.
- **Custom designs:** *Proofs*. Upload the proof image and send it. The customer approves or asks for one free change (more are ₦2,000 each). Their 5-day delivery clock starts when they approve.

## 8. Testing

```bash
npm run typecheck          # TypeScript for the app and the e2e specs
npm run lint               # ESLint (Next.js core-web-vitals + TypeScript)
npm test                   # unit tests: pricing, bundles, studio, Paystack signature, emails
npm run test:db            # integration tests against a real local Postgres
npm run test:e2e           # Playwright (needs a local Postgres + Chromium)
```

- `test:db` builds `pemart_test` from the migrations and runs checkout, webhook, post-purchase, admin and offer functions against it. Set `TEST_DB_URL=postgres://user:pass@localhost:5432` if your Postgres is not the default.
- `test:e2e` builds `pemart_e2e`, starts `next dev` on port 3200 with the simulated Paystack popup and runs the browser suites in `e2e/`: the buying flows (guest tee with code, Couple's Christmas Box, custom design, price tampering, ambassador commission), the proof round trip and paid revisions, the signed-webhook and duplicate-delivery checks, the Christmas cutoff notices, the admin and role gates, consent and analytics events, the first-order offer, SEO, axe accessibility scans (WCAG 2.1 AA) and CSP checks. First run installs nothing; if Chromium is missing run `npx playwright install chromium`.

## 9. How things work

- **Money** is integer kobo everywhere (`lib/money.ts`); prices are computed on the server (`lib/checkout/pricing.ts`) and re-checked in SQL.
- **Orders** follow a status machine mirrored in SQL and TypeScript (`lib/orders/status.ts`); custom orders wait in *awaiting proof* until a design is approved.
- **Security headers** (`next.config.ts`, `middleware.ts`, `lib/csp.ts`): HSTS, `X-Content-Type-Options`, frame denial, and a Content Security Policy. Admin, account, checkout, order and sign-in pages get a strict per-request **nonce** policy (`strict-dynamic`, no inline scripts). Public catalogue pages are static, so they keep a policy that allows inline scripts for Next.js hydration but still restricts every other source.
- **Uploads** use short-lived signed URLs; customer files and proofs live in private buckets.
- **First-order offer:** a popup (after 20 seconds, or desktop exit intent, once per device) and the footer sign-up both call `offer_claim`, which stores the contact with a consent timestamp and issues a single-use 10% code (valid 60 days), emailed and added to the bag.

## 10. Environment variables

See `.env.example` for the full list with comments.

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, sitemap, emails, Paystack callback |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | database, auth, storage |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` | payments |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL` | email |
| `CRON_SECRET` | the two scheduled jobs |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | analytics (optional, consent-gated) |
| `DATABASE_URL`, `PAYSTACK_MOCK` | **local development only** |
