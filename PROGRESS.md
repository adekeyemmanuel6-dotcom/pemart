# Pemart build progress

Last updated: Phase 1 complete (awaiting review).

## Status

| Phase | Status |
|---|---|
| 1. Foundation | **Done, ready for review** |
| 2. Catalogue | Next |
| 3. Bundles and custom | Not started |
| 4. Bag and checkout | Not started |
| 5. Accounts and post-purchase | Not started |
| 6. Admin | Not started |
| 7. Polish and launch | Not started |

## Phase 1: what exists

- **App**: Next.js 15 (App Router), React 19, TypeScript strict (`noUncheckedIndexedAccess` on), Tailwind v4 with the Pemart tokens as CSS variables and theme colours (`ink paper sand denim mocha ember muted line`). Fonts via `next/font` (Anton, Inter, Caveat), `display: swap`. Admin-only dark theme (`.admin-theme`).
- **Layout**: announcement bar (from `settings`), sticky header with Shop mega menu, mobile drawer with a prominent Gift Boxes link, bag button with live count, footer (collections, help, WhatsApp, Instagram, TikTok, newsletter, payment badges), floating WhatsApp button with a page-aware pre-filled message, skip link, focus rings.
- **Database** (`supabase/migrations/0001-0008`): every table from Part 4, integer-kobo money, RLS enabled on all tables (plus a safety-net loop that enables it on any future table), role helpers `is_staff()` / `is_admin()`, a trigger that stops customers editing their own role or store credit, order-number sequence (`PM-10001`), Postgres full-text + trigram search (`search_catalogue()`), storage buckets and policies.
- **Seed** (`supabase/seed.sql`, built from `supabase/seed/*.sql`): 6 collections, 20 designs with generated outlined-type SVG artwork, 59 products and 881 variants, 11 bundles with 40 slot rules, 3 delivery zones with Christmas cutoffs, settings, demo discount and ambassador codes.
- **Auth**: magic link and Google through server actions (rate limited), PKCE callback, sign-out, `requireProfile` / `requireStaff` / `requireAdmin` helpers, middleware session refresh. `/account` and `/admin` are gated on the server.
- **Libraries**: `lib/money.ts` (kobo only, tested), `lib/env.ts`, `lib/rate-limit.ts`, Supabase clients (server, browser, public cookie-free, service-role), Zustand bag skeleton, WhatsApp link builder.
- **Tests**: Vitest money tests (7 passing). `supabase/tests/verify.sql` checks RLS against local Postgres.

## How to run

```bash
npm install
npm run dev                 # works without Supabase: the shell renders with default settings
npm run test                # unit tests
npm run db:local            # rebuilds a local Postgres DB `pemart_local` from migrations + seed
su postgres -c "psql -d pemart_local -f supabase/tests/verify.sql"   # RLS checks
```

Style guide (dev only): `/dev/style`.

## Decisions and defaults (change if you disagree)

1. **Local Postgres first.** Migrations and seed were tested on Postgres 16 with `supabase/local-stub.sql`, which fakes `auth.users`, `auth.uid()`, `storage` and the API roles. Never run the stub on a real Supabase project. Connect a real project before Phase 4 (see README).
2. **No print partner anywhere.** Per your instruction there is no print partner setting, email or work-order flow. When an order moves to `in_production`, Phase 6 will only update status and the admin view/printable packing sheet. The `print-artwork` bucket still holds print-ready files for staff.
3. **Logo is uploaded in admin later.** `settings.logo_url` is null, so the header shows a typographic "PEMART" wordmark. Phase 6 adds the upload screen.
4. **Free-delivery threshold lives on `delivery_zones.free_over_kobo`** (Lagos: ₦75,000), not duplicated in `settings`. The Settings screen will edit it there.
5. **Two of Us designs are 3 matching designs** (his and hers share a design; the pair is enforced by `bundle_slots.matching_group`). The 20-design split is Kingdom 8, Word 4, Naija Mood 3, Two of Us 3, Christmas Drop 2.
6. **Placeholders to replace before launch**: WhatsApp number `2340000000000`, Instagram `instagram.com/pemart`, TikTok `tiktok.com/@pemart`, demo codes `PEMART10` and `GRACE10` (demo ambassador), all artwork and product images (SVG placeholders). Edit in admin or `supabase/seed/`.
7. **Artwork text is converted to outlines** (scripts/generate-art.mjs + Anton/Inter, both OFL) so it renders identically in `<img>` and is print-ready. Regenerate with `npm run gen:art` then `bash scripts/build-seed.sh`.
8. **Colour contrast**: white on ember is 3.9:1 (fails AA for small text), so small text on ember uses ink (4.7:1). Ember is never used as text on paper.
9. **CSP is in place but still allows `'unsafe-inline'` scripts** (Next hydration). Phase 7 moves to nonces.
10. **Rate limiting is in-memory** (per server instance). Fine for launch-scale; swap for Upstash/Vercel KV in `lib/rate-limit.ts` if traffic grows.
11. **Newsletter**: signup stores email + consent timestamp. Issuing the single-use 10% code lands with the pricing engine (Phase 4) and the popup (Phase 5). The footer copy "Get 10% off your first order" is already live, so do not launch before that is wired.
12. **ESLint is not configured yet** (ESLint 9 flat config); TypeScript strict is the gate for now. Added to Phase 7.
13. Stub pages exist for every nav link so nothing 404s. Each says which phase builds it.

## Known gaps (by design, later phases)

Catalogue pages, search UI, content pages (P2); bundle/custom/bulk (P3); bag drawer, checkout, Paystack, emails (P4); account orders and proofs (P5); admin screens (P6); Playwright, SEO, analytics, Lighthouse (P7).

## Needed before Phase 4

Supabase project URL + anon + service-role keys, Paystack test keys, Resend key, domain, real WhatsApp number.
