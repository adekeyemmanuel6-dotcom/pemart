# Premium redesign brief: audit and status

12 November 2026 · branch `codex/wear-the-word-upgrade` · Next.js 15 App Router, React 19, Tailwind 4, Supabase, Paystack, Vercel.

This compares the "Premium ecommerce redesign, mega menu and security hardening" brief against the branch. Much of the brief was already implemented in the earlier Wear The Word work (see `TRANSFORMATION-REPORT.md`); this round built the highest-priority gaps.

## Already in place before this round

| Brief area | Status on the branch |
| --- | --- |
| Design tokens (black, white, ivory, charcoal, gold, alert), Anton display + sans body, 2px radii, reduced-motion support | Implemented in `app/globals.css`. Muted text stays `#605B54` rather than the brief's `#777777`, which fails WCAG AA contrast for small text on white. |
| Announcement bar, admin-editable text/link/on-off | Implemented; scrolls away above the sticky header. |
| Homepage hero, collections, featured products, brand statement, gifting, couples, custom-order steps, community, newsletter | Implemented and editable in `/admin/website`. Campaign photography is a labelled placeholder until real images are uploaded. |
| Collection filters (type, colour, size, price) and sort (featured, newest, price) synced to the URL | Implemented in `components/product/product-grid.tsx`. |
| Product page gallery with thumbnails, zoom dialog, colour/size/option selectors with sold-out states, quantity, Add to bag, Buy now, size guide, back-in-stock, sticky mobile bar | Implemented in `components/product/product-view.tsx`. |
| Cart drawer with free-delivery progress (₦200,000 threshold, merchandise after discounts) | Implemented; server recalculates every total. |
| Nationwide delivery config (36 states + FCT, provider/service, verified rates, estimates, weight) | Implemented; unverified rates block payment. Requires migration 0014. |
| Paystack: server-side totals, server verification, signed webhook, idempotent settlement | Implemented and preserved. |
| Security headers incl. nonce-based CSP for sensitive routes, HSTS, nosniff, frame denial | Implemented in `next.config.ts`, `middleware.ts`, `lib/csp.ts`. |
| Admin/staff roles checked server-side, RLS on all 28 public tables | Implemented; needs verification with real accounts in staging. |

## Built in this round

1. **Header and mega menu (Phase 5).** Three levels: announcement bar, sticky header (nav left, centred logo, search/account/bag right), full-width panels for Shop, Collections, Gift Boxes and About with a featured campaign card. Hover intent (120 ms open, 180 ms close), click and keyboard toggle, Escape closes and returns focus, one panel at a time, `aria-expanded`/`aria-controls`, closes on navigation. Panels are built from real data in `lib/navigation.ts`: a product type, gift box or couple package only appears if it exists and is on sale. The website editor's Main menu links still appear (About panel).
2. **Mobile drawer.** Hamburger left, centred logo, search and bag right. Drill-down sections with a visible Back control, a prominent Gift Boxes button, account/track/contact links, focus moved to the new view and back, Escape closes, safe-area padding.
3. **Shared rate limiting (Phase 10.8).** `lib/rate-limit.ts` now uses a Postgres counter (`rate_limit_hit`, migration `0015_rate_limits.sql`) shared by every serverless instance, with the per-instance counter kept as a fallback so an outage never locks customers out. Keys are SHA-256 hashed; no IP or email is stored. All 19 call sites (auth, checkout, tracking, reviews, uploads, search, payments verify, bulk, custom, offers) updated.
4. **Trusted client IP.** `lib/client-ip.ts` prefers Vercel-set headers (`x-vercel-forwarded-for`, `x-real-ip`) over a client-supplied `x-forwarded-for`. On Vercel the old header was already overwritten by the edge, so this is defence in depth that also holds behind other proxies.
5. **Configuration.** Supabase/email/site variables extended to Preview; `CRON_SECRET` created for Production and Preview (sensitive).

## Verification this round

- Unit tests: 167 passed (11 new: rate limiter, IP selection, navigation). Typecheck and lint pass.
- Migration 0015 tested in PGlite: counts, blocks, resets, rejects invalid input, anon cannot execute or read, rollback removes it.
- Browser (local Chrome, demo catalogue): no horizontal overflow and no nav/logo overlap at 1024, 1280, 1440, 1920; panels full width; Escape returns focus; all 27 menu links return 200; mobile drawer at 320, 360, 375, 390, 430 with stable focus handling; Axe WCAG 2.2 A/AA: no violations in header (closed/open) or drawer.

## Security findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| S1 | Rate limits were per-instance, bypassable on serverless | High | Fixed in code; effective once migration 0015 is applied |
| S2 | IP for rate limiting read from client-controllable header (outside Vercel) | Low on Vercel | Fixed |
| S3 | `CRON_SECRET` unset, so order-expiry and reminder jobs refused every call | Medium (operational) | Fixed in Vercel env |
| S4 | No MFA required for admin accounts | High | **Open – launch blocker.** Needs Supabase MFA (TOTP) enrolment plus an `aal2` check in the admin guard, tested against real Supabase |
| S5 | No audit log of critical admin mutations (prices, stock, discounts, refunds) | Medium | **Open.** Needs an append-only table written inside the existing admin RPCs |
| S6 | Paystack keys exist for Production only | — | Add **test** keys for Preview to exercise checkout safely |
| S7 | `@react-email/*` packages deprecated upstream | Low | Open; upgrade separately with email regression tests |
| S8 | RLS and role behaviour verified only in isolated databases | — | Run the integration suite against a staging copy before launch |

## Not built, and why

- **Men / Women navigation.** Products have no gender or fit attribute, so these menus would be empty or invented. Add a `gender` field per product first; the navigation builder can then show them.
- **"Best sellers" from sales data.** There are zero orders; the homepage uses honest "featured" labels until sales exist.
- **Reviews section with ratings.** Only verified reviews are shown; none exist yet, so the community section stays.
- **Campaign and model photography.** Must be supplied; see `PHOTOGRAPHY-AND-CONTENT.md`.
- **Real delivery rates and timings.** Must be confirmed by the business in the admin after migration 0014.

## Release order (unchanged, plus 0015)

Back up Supabase → apply 0014 → apply 0015 → confirm delivery rates in admin → add Paystack test keys to Preview and run a test payment + webhook replay → resolve S4 → promote to Production. Rollback scripts for both migrations are in `supabase/rollback/`.
