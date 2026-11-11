# Pemart build progress

Last updated: Phase 2 complete (awaiting review).

## Status

| Phase | Status |
|---|---|
| 1. Foundation | Done, reviewed |
| 2. Catalogue | **Done, ready for review** |
| 3. Bundles and custom | Next |
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

## Phase 2: what exists

- **Data layer** (`lib/catalogue/`): one cached loader (`getCatalogue`, tag `catalogue`, 5-min revalidate) that reads Supabase when configured and otherwise a fixture exported from the seeded local DB (`npm run db:fixture`). Filtering, sorting, stock, price ranges, related products, bundle savings and bundle availability are pure functions (`helpers.ts`), covered by 10 new unit tests (17 total).
- **Pages**: Home (hero, trust strip, collections, best-sellers, gift boxes, couples, how custom works, photo wall, bulk banner, newsletter); `/collections/[slug]` including `all` (filter by type, colour, size, price band; sort by featured, newest, price; state lives in the URL, page stays static); `/products/[slug]` for all 59 products; `/search` (instant results); Delivery (fees pulled live from zones), Returns and Exchanges, Size Guide, FAQ (with FAQPage JSON-LD), About, Contact, Privacy, Terms. 404, error and skeleton states.
- **Product page**: gallery (front, back, close-up of the print), colour and size selectors with sold-out states, option pickers (scent for him/her, bracelet style, frame finish, gift card amount), size guide drawer (cm, oversized note), delivery estimate by state (remembered), quantity, Add to bag, Buy now, "Complete the look" bundle offer with the saving, back-in-stock email signup, story/verse (KJV), fabric and care, reviews (empty state until real reviews exist), related products, sticky mobile Add to bag bar.
- **Mockups**: `GarmentMockup` draws tee and hoodie front/back in all colours with the design artwork placed on it (dark ink on Sand), plus `FrameMockup`. Pure SVG/CSS, no bundle weight.
- **SEO**: unique titles/descriptions, canonical URLs, Product + Offer (NGN) + BreadcrumbList JSON-LD, per-product Open Graph image at `/og/[slug]`, `sitemap.xml`, `robots.txt`. Unknown slugs return real 404s.
- **Search**: `/api/search` calls the Postgres `search_catalogue()` function when Supabase is connected (full-text prefix match plus trigram typo tolerance) and an equivalent in-memory search otherwise. Rate limited.

## Phase 2 decisions

14. **Whole catalogue is loaded and filtered in memory.** Fine for dozens of products and keeps pages statically generated with ISR. If the catalogue grows past a few thousand variants, move filtering into SQL.
15. **Garment imagery is generated mockups** until you upload real photos. Any product with an uploaded image (non-placeholder) automatically uses its photos instead. The "on-model" view appears only when a real model photo exists (no fake placeholder slot).
16. **No customer photo wall content.** The "Worn by you" section shows a tag-us prompt until real photos are added to `lib/ugc.ts`. No invented social proof.
17. **Size chart values are placeholders** (`lib/size-guide.ts`). Check them against your supplier's real measurements.
18. **Privacy and Terms are sensible drafts, not legal advice.** Have them reviewed before launch. Contact page is WhatsApp-first; no email address is published until you give one.
19. **Add to bag** stores only ids and quantities (Zustand, localStorage). The bag drawer, pricing and checkout are Phase 4; "Buy now" currently goes to the `/bag` placeholder.
20. **"Complete the look"** links to `/bundles/[slug]?start=<product>`; the bundle builder that reads it is Phase 3.
21. **Delivery estimate uses calendar days** (promised = today + lead days). The Christmas-cutoff warning is added with checkout in Phase 4.
22. **Touch devices** get a flip button on product cards (there is no hover); desktop uses hover/focus.

## Known gaps (by design, later phases)

Bundle builder, couples and gift box hubs, custom studio, bulk quotes (P3); bag drawer, checkout, Paystack, emails (P4); account orders and proofs (P5); admin screens (P6); Playwright, SEO, analytics, Lighthouse (P7).

## Needed before Phase 4

Supabase project URL + anon + service-role keys, Paystack test keys, Resend key, domain, real WhatsApp number.
