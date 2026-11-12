# Wear The Word transformation — pre-implementation audit

Repository: adekeyemmanuel6-dotcom/pemart. Audit date: 12 November 2026.

## Existing foundation
Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Zustand bag, Supabase Auth/Postgres/Storage, Paystack and Resend. Catalogue, bundles with independent slot selections, custom proofs, customer accounts, wishlist, reviews, order tracking, admin catalogue/orders/promotions/settings and SEO routes already exist. Existing code calculates prices on the server, checks Paystack signatures and settles payments through an idempotent SQL function. These are code findings, not verification of the production services.

## Improvements required
Pemart-first branding; dated Christmas defaults and five-day promises; old collection navigation; no editorial campaign assets in the repository; no multi-theme product assignments. Delivery currently selects an unrelated last zone when no state matches, offers a per-zone threshold framed around Lagos, and does not model city/provider/verified rates. Checkout substitutes an email prefix for a missing recipient name. Catalogue loading can substitute demo products on production builds. No production credentials or database access were supplied for this checkout.

## Preserve
Framework, routes, database IDs and foreign keys, existing orders, inventory and reservation logic, discounts and gift cards, bundle slot architecture, custom proof workflow, Paystack initialize/verify/webhook/settlement, role checks, RLS and existing deployment project. No reset, seed execution, destructive migration or production deployment.

## Incremental implementation
1. Introduce the Wear The Word identity and shared editorial design tokens; reuse admin-uploaded logo, existing UI, product and bundle components.
2. Recompose homepage and story with real catalogue data, thematic browsing, accurate gift contents, community content only when real. Provide explicit campaign placeholders and a photography brief where assets are absent.
3. Extend existing delivery zones and settings additively: city, provider, service, verified rate, active flag, estimates, optional weight constraints; default national threshold ₦200,000 after discounts; dispatch from Akure. Missing/uncertain rates block payment until configured. Keep monetary calculations in integer kobo.
4. Extend protected admin forms and RPC allowlists; preserve catalogue IDs and legacy collection routes. Prepare reversible SQL; do not apply it to Supabase without review.
5. Update customer-facing delivery copy, branding/metadata, consent-aware analytics and accessibility. Run existing unit, type, lint and build checks, plus targeted shipping tests and browser checks when available.

## Risks and deployment gates
Schema-dependent shipping changes must ship with the reviewed migration and confirmed rates. Existing seeded rates are not evidence of real carrier prices. No rate is invented. Catalogue failure must not expose demo stock in production. Production database policies, Vercel environment, Paystack test transactions, customer orders, actual shipping quotes and real logo/photography need verification before release. Historical test results in PROGRESS.md are not results from this session. The live website could not be fetched by the web reader; browser inspection remains pending.

Deployment requires all critical checks and explicit owner approval, per the supplied brief.
