# Wear The Word by Pemart Global — implementation report

12 November 2026. Repository: `adekeyemmanuel6-dotcom/pemart`. Local branch: `codex/wear-the-word-upgrade`.

**Status: local implementation prepared for review; not approved for production.** No GitHub push, Vercel deployment, live database migration, real payment, or customer-data modification was performed. The attached source archive and patch contain the implementation. Screenshots show an explicitly labelled local demonstration catalogue, not live inventory.

## What changed

- Introduced the Wear The Word identity, black/white/cream/charcoal/gold palette, local display font, shared editorial components, responsive navigation, updated footer, and transactional email/WhatsApp wording. Existing uploaded logos remain supported; the fallback is a plain wordmark.
- Reworked the homepage around the campaign, five collections, featured products, brand philosophy, ten message themes, existing gifts, design stories, matching pieces, genuine community content, bulk orders, and newsletter. Reworked the About and delivery pages. Missing editorial photographs have labelled placeholders and an asset brief.
- Added five branded collection entrances and ten theme routes. Products support multiple themes and branded collection assignments while retaining their original IDs and collection relationships. Existing collection URLs remain.
- Added product image zoom and Buy Now. Retained image galleries, sizes, colours, quantity, reviews, related products, and existing bundle selection. Removed unsupported hardcoded fabric and delivery claims.
- Implemented configurable nationwide shipping for all 36 states and FCT, city matching, provider/service selection, verified rates, active status, estimates, optional packed-weight charges, and free-delivery eligibility. Dispatch defaults to Akure, Ondo State, Nigeria.
- The default free-delivery threshold is ₦200,000 of eligible merchandise after discounts. Shipping, gift cards, revision charges, and non-merchandise extras do not inflate eligibility. The server and order transaction validate the fee. A missing or unverified rate blocks payment with the requested confirmation message. New orders preserve a shipping snapshot so later rate edits do not silently change the paid charge.
- Extended protected admin settings and product forms for hero content, shipping configuration, themes, collections, and verified packed weights. Retained existing catalogue, inventory, order, promotion, bundle, and proof-management interfaces.
- Updated metadata, organisation identity, collection descriptions, sitemap links, and optional Search Console verification. Extended consent-aware events for newsletter, floating WhatsApp, custom enquiries, and bulk enquiries. Existing product/cart/checkout and verified-purchase tracking remains.
- Production catalogue loading now fails when Supabase is unavailable rather than substituting demonstration products.

## Preserved foundation

Next.js App Router, React, Tailwind, existing routes, Zustand cart, Supabase architecture, product/order identifiers and relationships, inventory reservations, discounts, gift cards, custom proofs, independent bundle size selections, Paystack initialization/verification/webhooks, and idempotent payment settlement remain. Existing RLS and admin role gates remain. These are implementation findings; production accounts and policies still require staging verification.

## Database and configuration

`supabase/migrations/0014_wear_the_word.sql` is additive and was tested only in an isolated database. It adds settings, product assignments/weights, shipping configuration, and order snapshots, and updates relevant existing RPC functions. Existing rates default to unverified. It does not delete products or orders, seed carrier prices, or reset the database.

`supabase/rollback/0014_wear_the_word.sql` restores previous function definitions while retaining new columns and records. Roll back the application with it. Read `MIGRATION-REVIEW.md` before applying either script; compare the real schema and back up the project first.

New optional environment variable: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`. Existing Supabase, Paystack, site URL, email, analytics, and support settings are still required as appropriate. No production credentials were supplied, printed, or added. No runtime dependencies were added to the application manifest or lockfile. Temporary validation tools were installed outside the application; they are excluded from the source archive.

## Verification

Detailed machine-readable results are supplied alongside this report. Local validation uses synthetic records and does not establish production readiness.

- Unit tests: **125 passed**, including new shipping boundary, destination, verification, provider, and weight cases.
- TypeScript application check: **passed**. The existing browser-test TypeScript project was also checked during implementation.
- ESLint: **passed**, including the final standalone check and Next.js build checks.
- Isolated SQL verification: **11 checks passed** using PGlite with local Supabase stubs. Checked migration compilation, record preservation, rejected unverified/mismatched delivery, threshold boundaries, inconsistent totals, wrong payment amount, idempotent settlement, shipping snapshots, permissions, and non-destructive rollback. This is not a real Supabase integration test.
- The existing 77-test integration suite was attempted against a temporary PGlite TCP adapter: **1 passed, 53 failed, 23 skipped**. Failures include connection resets and downstream unavailable-catalogue/checkout errors. This run is not a passing integration gate. It must be rerun against compatible PostgreSQL and staging Supabase; remaining application failures, if any, must be resolved there.
- Browser checks verified local product zoom, size selection, add-to-bag, persisted cart, quantity changes, all 37 destinations, payment blocking for unverified delivery, anonymous admin redirection, mobile menu opening/Escape dismissal, and desktop sign-in rendering. Twenty-nine page/viewport checks returned HTTP 200 without horizontal overflow; desktop sign-in completed in a separate follow-up. Homepage checks at 360, 768, and 1440 pixels found no horizontal overflow and no automated Axe WCAG A/AA violations. This is a focused automated check, not a full accessibility certification. Slow development rendering and test-harness issues caused initial failures; follow-up results are recorded separately.
- Production build: **compiled successfully and passed lint/type checks, then failed while collecting page data** with `Supabase must be configured for a production catalogue.` The required Supabase credentials are absent. This is a failed build, not a release pass. No production-demo bypass was introduced. Full output is in `build.log`.

## Remaining release work

1. Connect a staging copy of the existing Supabase project and the existing Vercel environment. Compare actual schema/RLS with the repository, review and apply the migration in staging, verify roles using genuine admin/staff/customer accounts, and run the complete integration/browser suites.
2. Verify actual carrier prices, city/state coverage, service options, packed weights, and delivery estimates in admin. Confirm all 37 destinations have appropriate services before advertising operational nationwide checkout. Flat-rate services are required for bundles/custom pieces until a verified package-weight source exists.
3. Supply the original logo and approved campaign, collection, product, and gift-box photographs. Confirm product material/fit/size-guide details, stored Scripture wording and translations, production timelines, returns terms, and social/support destinations.
4. Configure the requested Signature, Couple’s, Family Legacy, Man of Faith, Woman of Faith, and Purpose & Encouragement packages with actual contents, prices, and inventory in the existing bundle editor. Existing packages were retained; missing packages and prices were not invented. Confirm theme/collection assignments using real products. Sales-ranked bestsellers require actual sales data; the homepage currently labels featured products honestly. Recent-view history and TikTok Pixel were not added; TikTok remains optional until required/configured.
5. Test actual Paystack test-mode initialization, callback, signed webhook/replay, order creation, stock reservation, refunds/failure states, and post-purchase messages. Test authenticated product/shipping management, custom submissions, bulk enquiries, newsletter delivery, and WhatsApp links with real staging configuration. Verify analytics consent and purchase deduplication with the configured identifiers.
6. Run a successful production build, test deployed-preview performance/Core Web Vitals and accessibility with final imagery, and obtain owner approval before deploying to the existing Vercel project.

**Deployment is blocked until these critical checks and configuration gaps are resolved.** The current files are a reviewable implementation, not a claim that the live transformation is complete.

## Reviewing the deliverables

The source ZIP contains the existing application plus the changes, excluding dependencies, build output, Git metadata, local test outboxes, and private environment files. The patch is based on commit `040cbf99ef098aace3ab9b00d4db2d643b5beb94`. Use the existing `npm ci` and `npm run dev` commands for a local preview. Install matching supported Node dependencies on your machine; this Windows session used an isolated Node 24 runtime to avoid a host Node 22 path-permission issue. Local previews without Supabase show an explicit demonstration banner and cannot take live payments. Configure staging through secure environment settings; do not paste secrets into the report or commit them.
