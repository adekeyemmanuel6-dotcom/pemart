# Admin control centre: capability audit and build status

13 November 2026 · branch `claude/admin-control-centre` (from production `a4680e5`) · Next.js 15, Supabase, Paystack, Vercel.

Method: read every route under `app/admin`, every server action in `lib/admin`, every `admin_*` SQL function in `supabase/migrations`, and the website content schema. The existing admin is well beyond "basic forms": every page checks the role on the server, every action goes through SQL functions that re-check the role in the database, and money-critical state (payment, stock, totals) only changes inside trusted transactions.

## 1. Audit

| Module | Existing (verified in code) | Missing | Proposed / status |
| --- | --- | --- | --- |
| Shell & layout | Header with a horizontal link row; dark admin theme; role-filtered links | Sidebar, grouping, breadcrumbs, global search, account menu, mobile drawer | **Built this round**: grouped collapsible sidebar, top bar, breadcrumbs, account menu, mobile drawer, global search |
| Dashboard | Today/7-day revenue and orders, AOV, bundle share, checkout conversion, orders due in 48 h, at-risk orders, proofs waiting/overdue, low stock, new quotes, pending reviews, refunds needed | Date-range picker on the overview (Reports has one) | Keep; revisit with real sales data |
| Products | Create/edit name, slug, type, design, collection, brand collections, description, details, fabric & care, price, compare-at, SEO title/description, verified packed weight; photo manager; variant generator (colours × sizes × options); per-variant price override; stock adjust with reason log; active toggle | Draft/archived/scheduled states, cost price, tags, bulk edit, CSV import/export, duplicate | Next milestone (needs migration for status/cost/tags; CSV import with dry-run preview) |
| Collections | Create/edit name, slug, intro, hero image, order, active, seasonal; brand collection cards editable in Website | Mobile image, collection SEO fields, rule-based collections | Next milestone |
| Inventory | Stock per variant, reservations, adjustment log, low-stock list | Dedicated inventory screen across products | Next milestone (data already exists) |
| Orders | Filtered/paginated list (search, status, zone, custom, promised dates, unpaid), detail with items/variants/payment/timeline, status moves, bulk status, internal notes, recorded refunds, packing slip | Tracking number + carrier fields, printable invoice, CSV export | Next milestone. Payment status already cannot be set from the admin; only verified Paystack settlement marks an order paid |
| Customers | Searchable list with orders/spend, CSV export | Notes, consent column, segments | Next milestone |
| Website editor | Brand & SEO, palette, heading style, 12 homepage sections (copy, image, buttons, show/hide, reorder), navigation lists, collection cards, community photos, legal/info pages, custom pages, preview, discard, optimistic-locked publish | Version history and rollback; drafts saved server-side; new sections from templates; device-specific images; three-panel live preview | **Built this round**: version history + restore. Next: server-side drafts, section templates, mobile images |
| Navigation & menus | Main/shop/help/legal link lists | Editable mega menu (panels, columns, featured card, device visibility) | **Built this round**: mega menu builder, with automatic menu as the default |
| Media library | Uploads to Supabase Storage via signed URLs (role-checked, size/type limited) | Central library, alt-text reuse, usage tracking | Next milestone (needs a `media_assets` table) |
| Marketing | Discount codes (%, fixed, min spend, dates, total and per-customer limits), ambassadors and commissions, announcement bar, bag upsell offer | Product/collection-restricted discounts in the UI, scheduled banners | Next milestone |
| Gift boxes & bundles | Bundle editor with slots, allowed products/designs, price, availability window, badge | Packaging choices, per-bundle stock rules | Next milestone |
| Custom orders | Proof queue, upload proof, revision requests, approval timestamps, production board | — | Already complete for current workflow |
| Reviews | Moderation (approve/reject), verified purchase link, store credit on photo reviews | Public replies | Later |
| Shipping & delivery | All 36 states + FCT, cities, provider, service, verified flag, estimates, weight charges, free-delivery threshold and eligibility, active toggle (migration 0014) | Pickup option | 0014 must be applied |
| Payments | Paystack initialise, server verify, signed webhook, idempotent settlement | Status/health screen | Next milestone (show key mode and last webhook, never the key) |
| Reports | Revenue by day, best-selling products/designs, by collection, zone, ambassador, bundles, date range, CSV | Returning customers, refunds view | Later |
| SEO | Product SEO, brand SEO/OG image, page descriptions, sitemap, structured data | Collection SEO, redirects manager | Next milestone |
| Users & permissions | Roles `customer`/`staff`/`admin`, checked in pages, actions, SQL and RLS; promotion only via SQL editor | Admin UI for team, granular roles | **Built this round**: Team page (grant/revoke staff/admin by email, 2FA status, last-admin and self-demotion guards). Granular roles: designed below, next milestone |
| Activity logs | Order timeline, inventory adjustment log | General audit trail of admin changes | **Built this round**: automatic audit log of every admin change (who, when, what changed) |
| Security | Server role gates, RLS on all tables, CSP/HSTS, rate limiting (shared after 0015), admin two-factor (app now, DB after 0016), webhook signature checks | Audit trail, granular permissions | Audit trail built; granular permissions next |

## 2. What this round changes

1. **Admin shell** (`app/admin/layout.tsx`, `components/admin/admin-shell.tsx`, `lib/admin/nav.ts`): grouped sidebar (Overview · Sales · Catalogue · Website · Marketing · Insights · Store), collapsible on desktop, drawer on mobile, breadcrumbs, account menu, global search (`/admin/search`) across orders, customers and products. Modules that do not exist yet are not shown.
2. **Migration `0017_admin_control.sql`** (unapplied; needs 0014 first):
   - `audit_log` table and triggers on products, variants, images, designs, collections, bundles, bundle slots, discounts, delivery zones, settings, reviews and profile roles. The acting admin is recorded by `_require()` (every admin SQL function already calls it), so no change could slip through unlogged. Checkout, payment and customer actions are not logged here (they have their own records).
   - `website_revisions`: every publish keeps a snapshot; `admin_website_restore` republishes an earlier version as a new revision (history is never rewritten).
   - `admin_team_list`, `admin_set_role` (admin only, cannot change your own role, cannot remove the last admin), `admin_activity_list`.
3. **Website history** in the editor: list of published versions with time and author, one-click restore with confirmation.
4. **Mega menu builder**: a "Mega menu" tab. Choose Automatic (built from live products, as now) or Custom. Custom menus have panels → columns → links, an optional featured image card, and desktop/mobile visibility per panel and per link. Structure is fixed at three levels, so circular nesting is impossible; links are validated as internal paths or https URLs.
5. **Team** (`/admin/team`) and **Activity** (`/admin/activity`) pages.

## 3. Granular roles (designed, next milestone)

Keep `profiles.role` as the coarse gate and add `profiles.permissions text[]` from a fixed list: `orders`, `fulfilment`, `customers`, `catalogue`, `content`, `marketing`, `reports`, `settings`, `team`. Presets: Owner (all), Store Manager (orders, fulfilment, customers, catalogue, reports), Content Editor (content, marketing), Fulfilment (orders, fulfilment), Support (orders, customers). Enforce in `_require()` by passing the permission each SQL function needs, so the database stays the final gate. This touches every admin SQL function, so it is a separate, fully tested migration.

## 4. Release order

0014 → 0015 → (admins set up two-factor) → deploy this branch → 0016 → 0017 → 0018.

**Important:** without 0014, publishing from the Website editor cannot work (the `admin_website_save` function does not exist yet). That is why edits did not reach the storefront. The editor now says so plainly instead of failing quietly. Each has a rollback script in `supabase/rollback/`. Until 0017 is applied, Team, Activity and Website history show a "needs database update" notice instead of failing.

## 5. Verification (this round)

- **Integration tests against real PostgreSQL 16, all 17 migrations + seed: 92/92 pass.** This includes the existing 77 (checkout, Paystack webhook, payment amount checks, admin functions, offers), which had never fully passed before. Four were out of date after 0014 (they expected the old ₦75,000 per-zone free delivery and priced delivery from a separate state field instead of the delivery address); they now follow the ₦200,000 rule and address-based pricing. The 15 new tests cover the audit trail, website history/restore with optimistic locking, team roles, self-demotion, the last-admin rule, a concurrent two-admin demotion race, and that existing admin functions still enforce roles.
- **Unit tests: 180 pass** (mega menu validation incl. `javascript:`, `//`, `http:` and credential links rejected; device visibility; older content without a menu still valid).
- **Migration 0017**: applies cleanly, re-runs safely, rollback restores the previous functions and removes triggers.
- **Browser walkthrough (local Chrome, local Postgres)**: sidebar, collapse persisted, breadcrumbs, global search; custom mega menu published → storefront header changed → switched back → version 1 restored from history → storefront changed again; team grant / self-demotion refused / unknown email refused; activity log shows `role: customer → staff`; staff see only operational links and are refused Team, Activity, Website, Settings; mobile drawer at 390 px without horizontal scroll; no browser errors.
- **Without 0017** (the current production database): Team and Activity show a "needs a database update" notice, the editor hides history, and publishing still works.
- Two gaps in the local Supabase stand-in were fixed so tests match real Supabase: `auth.jwt()` (used by 0016) and `auth.users.last_sign_in_at`.

## 6. Round 2: storefront look and crypto payments

- **Logo**: new Wear The Word logo, black on light backgrounds (header) and white on dark (footer, admin sidebar). Both can be replaced in Website editor → Brand & SEO.
- **Colours**: black, white and gold throughout. Menu items have no underline and turn gold on hover; buttons turn gold on hover. Gold used for text is a darker gold (#8C6B1F, 4.9:1 on white) so it stays readable.
- **Hero styles** (Website editor → Homepage → hero): Sliding banners (up to 3, separate desktop / laptop / phone images, arrows, dots, swipe, keyboard, pause button, no autoplay for reduced motion), Text and image (50/50), or Banner with centred text and a rounded button.
- **Section style** for every homepage section: heading font, letter case, heading size, text font, background (white, ivory, black, gold), alignment and spacing. The newsletter section is now centred.
- **Pay with crypto** (migration `0018_crypto_payments.sql`): Settings → Pay with crypto holds up to 4 wallets (coin, network, address, note) and instructions. Buyers choose crypto at checkout, see the addresses and the Naira amount, and send their transaction hash. Only an admin can confirm the money arrived; that settles the order through the same code as Paystack. Wallets are copied onto each order, so a later address change never redirects an existing order. Tested: 7 integration tests against Postgres, plus a browser walkthrough (setup → checkout → hash → staff refused → admin confirms → paid).
