# Pemart build progress

Last updated: Phase 7 complete (awaiting review). All seven phases are built.

## Status

| Phase | Status |
|---|---|
| 1. Foundation | Done, reviewed |
| 2. Catalogue | Done, reviewed |
| 3. Bundles and custom | Done, reviewed |
| 4. Bag and checkout | Done, reviewed |
| 5. Accounts and post-purchase | Done, reviewed |
| 6. Admin | Done, reviewed |
| 7. Polish and launch | **Done, ready for review** |

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
9. **CSP**: admin, account, checkout, order and sign-in pages now use a per-request nonce with `strict-dynamic` (Phase 7, decision 62). Public static pages keep `'unsafe-inline'` scripts for hydration.
10. **Rate limiting is in-memory** (per server instance). Fine for launch-scale; swap for Upstash/Vercel KV in `lib/rate-limit.ts` if traffic grows.
11. **Newsletter**: signup stores email + consent timestamp and now issues the single-use 10% code (Phase 7, decision 63), so the footer promise is honoured.
12. **ESLint** is configured (flat config, `npm run lint`, clean) since Phase 7.
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

## Phase 3: what exists

- **Bundle builder** (`/bundles/[slug]`, all 11 bundles): per item the customer picks a design (from the allowed list), colour, size, and option (scent, bracelet style, frame finish, orb colour), with a live mockup per item and a "what's inside" summary showing the crossed-out separate total, the bundle price and the saving. Matching items (couples, family) share one design. His/her perfumes only offer his/her scents. The name frame takes the names to print. Gift card message (160 chars) and an optional gift wrap add-on (price from settings). Links like `?start=seek-first-tee` or `?design=my-beloved&his=L&her=M` prefill the builder.
- **Shared validation** (`lib/bundles/selection.ts`): one pure `validateSelection` used by the browser for live feedback and (Phase 4) by the server as the authority. Covered by 11 unit tests, including matching designs, wrong scents, sold-out choices, expired gift boxes and odd characters.
- **Gift Boxes hub** (`/gift-boxes`): ticking countdown to the Christmas cutoff for the visitor's area (Lagos 17 Dec, South-West and Other states 15 Dec, all editable data), cutoff list for every zone, and after a cutoff a clear notice plus ready-stock items and a gift card link. After 24 Dec the hub shows a "season has ended" state and boxes stop being offered.
- **Couples hub** (`/couples`): side-by-side his/hers mockups, matching design picker, package picker, separate his and hers size selectors, then continue into the builder prefilled. All couple packages listed.
- **Custom design studio** (`/custom`): three tiers (Personalise ₦3,000 / 12h, Text design ₦5,000 / 24h, Full custom ₦15,000 / 48h), live front and back preview that updates as you type, garment type (tee or hoodie), colour, size, print position (back, front, both), six type styles, personalise name/date/verse, private uploads (PNG, JPG, PDF, SVG up to 20MB) with a rights notice and required confirmation. The 5-day clock, proof promise and final-sale rules are stated on the page.
- **Uploads**: `/api/uploads/sign` checks type and size, rate limits, and issues a one-time signed URL for a private bucket; the file goes straight from the browser to storage. Fees are taken from server constants (`lib/custom/tiers.ts`), never from the browser.
- **Bulk orders** (`/bulk`): tiers explained (10 to 24: 10%, 25 to 99: 15%, 100+ by quote), quote form with Nigerian phone validation, size breakdown, date, idea and uploads, saved to `bulk_quotes`. The tier shows live as you type the quantity.
- **Gift cards page** (`/gift-cards`) pointing to the gift card product.
- **Tests**: 55 unit tests (was 17). Browser run covered the bundle builder, couple prefill, the cutoff countdown (clock set to 18 Dec), the studio, bulk validation and the upload rules.

## Phase 3 decisions

23. **Expired bundles stay readable.** Migration `0009` removes the date window from the bundle RLS policy so pages can say "this gift box has ended" instead of a bare 404. Availability is enforced in app code, and the Phase 4 checkout server re-validates every bundle before creating an order.
24. **Studio preview is not saved as an image.** The brief is stored as fields (`custom_requests.text_fields`, `type_style`, etc.). Admin (Phase 6) re-renders the same preview from those fields with the same components, so nothing can drift.
25. **Custom requests are saved as drafts.** Payment and the move to `awaiting_proof` happen at checkout (Phase 4). The studio offers tee and hoodie only; frames can be personalised through bundles.
26. **Demo mode without Supabase.** The studio, bulk form and uploader work end to end but nothing is persisted (they say so on screen). Once Supabase is connected they save for real.
27. **Bulk quote notification to admin is not sent yet.** The email system arrives in Phase 4 and the admin pipeline in Phase 6. Right now the request is saved and the customer gets a WhatsApp link to message you.
28. **Frame size in bundles comes from the slot label** ("A4 scripture frame" is A4, an "A3" label would be A3).
29. **Studio fonts**: Anton, Bebas Neue, Playfair Display, Permanent Marker, Space Mono, Caveat (all open licence), loaded only on `/custom`.
30. **Bug fixed:** React 19 clears uncontrolled form fields after a server action finishes, so a validation error wiped the visitor's inputs. Actions now echo submitted values (bulk, sign-in, newsletter) and the fields refill.
31. **Gift card delivery** (recipient email, message, code email) is built with checkout in Phase 4.

## Phase 4: what exists

- **Bag**: slide-out drawer (opens on add, or from the header bag) and a full `/bag` page. Each line shows its options; bundles are one line with "What's inside" listing every slot; gift message and gift wrap shown; quantity controls; one configurable upsell (the bracelet at ₦4,500, from settings); free-delivery progress bar ("₦55,200 away from free delivery in Lagos"); discount and gift card code fields; estimated delivery date; live stock (an item that sells out is flagged and blocks checkout).
- **Pricing engine** (`lib/checkout/pricing.ts`): one pure function used by the bag preview and the real checkout, so they cannot disagree. Covers variants, bundles (validated with the Phase 3 selection rules), custom designs (garment + server-side tier fee), gift cards bought and spent, store credit, discount and ambassador codes (min spend, dates, usage and per-customer limits, collection/product restrictions, never on gift cards), delivery zones and the free-Lagos threshold (judged after discounts), gift wrap, surprise note (Lagos only), express 48h (ready designs only), ship-ready-first, promised dates, and Christmas lateness warnings. 41 unit tests.
- **Checkout** (`/checkout`): one page. Contact (Nigerian phone validation, optional account link), delivery with state to zone and fee, gift to another recipient with a message, extras, review with the promised date, Christmas warning, required final-sale checkbox for custom items, pay with Paystack. Fully gift-card-covered orders skip payment. Digital-only orders (gift cards) skip the address.
- **Paystack** (`lib/paystack.ts`, `/api/payments/verify`, `/api/webhooks/paystack`): the server initialises the transaction for the amount it computed; after the popup the server asks Paystack and the database checks amount and currency; the webhook verifies the HMAC-SHA512 signature over the raw body, handles `charge.success` idempotently and stores the raw payload. Card, bank transfer and USSD channels. Structured logs for every payment and webhook event.
- **Orders in the database** (`0010_checkout.sql`): single-transaction SQL functions for create order (with row-locked stock holds), mark paid (idempotent), expire, cancel, live stock, guest order lookup, and custom request creation. Executable by the service role only.
- **Order page** (`/order/[number]?t=token`): confirmation with items (bundle slots listed), totals, delivery address, timeline, WhatsApp link. Guests need the private link token; owners can open it when signed in.
- **Emails** (React Email via Resend): order confirmation (every bundle selection, gift messages, promised date or the proof/5-day explanation), gift card delivery, bulk quote receipt plus admin notification. Without a Resend key they are written to `./.outbox`.
- **Notifications structure** (`lib/notifications`): email channel now; WhatsApp click-to-chat links with the order number and status pre-filled; a `WhatsAppChannel` interface where the WhatsApp Business Cloud API plugs in later with no other changes.
- **Cron**: `/api/cron/expire` (secret-protected, hourly in `vercel.json`) cancels unpaid orders after 24 hours and releases stock, credit and gift card balance.

## Acceptance tests covered so far

| Part 7 acceptance test | Where it is verified |
|---|---|
| Guest buys a tee to Lagos with a code, pays, total correct, promised date 5 days out | `tests/e2e/checkout-flows.cjs` (A) + `tests/integration/checkout.test.ts` |
| Couple's Christmas Box: every selection in the bag, the order and the confirmation email | e2e (B). Admin view and print partner are Phase 6 (print partner removed by your request) |
| Custom text design pays, sits in `awaiting_proof`; admin sends a proof, customer requests a revision, admin sends a second proof, customer approves, and only then are `production_start_at` and `promised_by` set | `tests/e2e/post-purchase-flows.cjs` (2) + `tests/integration/post-purchase.test.ts` (the admin screen that uploads the proof is Phase 6; the same function it will call is what is tested) |
| Browser price tampering does not change the charge | pricing unit tests + e2e (D) + integration |
| Fake/replayed webhook rejected; duplicate valid webhook does not double-process | `tests/integration/webhook.test.ts` (unsigned, wrong key, forged amount, replays, verify/webhook race) |
| After a zone's Christmas cutoff gift boxes show the notice and checkout warns | Phase 3 hub (browser, clock set to 18 Dec) + pricing unit tests for the checkout warning |
| Ambassador code gives 10% off and creates a pending commission | e2e (G) + integration |
| Staff cannot open settings, discounts or reports | Staff vs customer gate verified (customer is refused `/admin`, staff admitted). The settings/discounts/reports screens and their admin-only gate are Phase 6 |

## Phase 4 decisions

32. **Money-critical work lives in SQL functions**, reached through one doorway (`lib/db.ts`): the Supabase service role in production, or a plain Postgres URL in local development. The Postgres route is refused when `NODE_ENV=production`, as is the Paystack mock.
33. **Store credit and gift card balance are deducted when the order is created** (held) and restored if it is cancelled or expires. That makes double-spending impossible; the cost is that an abandoned checkout briefly locks that balance (max 24 hours).
34. **Gift wrap**: a bundle's own "gift wrap" switch costs ₦2,000 per wrapped bundle, and the checkout checkbox adds ₦2,000 once for the whole order.
35. **Express** = 2-day production for ready designs only (not custom items, and not bundles with printed names). **Ship ready items first** (mixed orders) costs one extra delivery fee. By default a mixed order ships together after the proof is approved.
36. **A payment that arrives after the order expired** restores the order if stock is still there; otherwise the order stays cancelled and is flagged "Refund needed" (Phase 6 shows these).
37. **The 1-hour abandoned-checkout email is Phase 5** (it needs the scheduled email run alongside the other reminders). The 24-hour cancellation is done.
38. **Webhook replies**: valid signature gets 200 even for events we ignore or amounts that do not match (so Paystack stops retrying and the order stays unpaid and logged); only a database failure returns 500 to trigger a retry.
39. **Catalogue prices come from the cached catalogue, but stock is live** (overlaid from the database on every quote). A race is still impossible because the SQL function re-checks stock under a row lock.
40. **The "create an account" checkbox** emails a sign-in link after the order (needs Supabase, so it is untested here).
41. **Dev gotchas**: seed UUIDs are random per database build, so after `npm run db:local` run `npm run db:fixture` and `rm -rf .next` (Next caches the old catalogue on disk).
42. **Vercel cron** runs hourly in `vercel.json`; hourly crons need the Pro plan. On Hobby change the schedule to daily (orders then expire up to a day late).

## Before this goes live (Phase 4 items)

Paystack **live** keys and the webhook URL `https://YOUR-DOMAIN/api/webhooks/paystack` set in the Paystack dashboard; Resend domain verified and `EMAIL_FROM` set; `CRON_SECRET` set in Vercel; `ADMIN_NOTIFY_EMAIL` set for bulk quote alerts.

## Phase 5: what exists

- **Order tracking** (`/track`): order number + the email or phone used, no login. One generic "not found" message for a wrong number or a wrong contact (so nobody can probe order numbers), rate limited, and the visitor's typing is kept after an error. A match redirects to the private order page.
- **Proof round trip** (all SQL functions, tested): staff attach a proof (`proof_send`), the customer approves or asks for changes on the order page with their private link or from their account (`proof_respond`). One free revision; after that an **extra revision costs ₦2,000** (setting) and goes through normal checkout as a digital add-on line, granting exactly one more. Approving the **last** custom design in an order starts the 5-day clock (`production_start_at`, `promised_by`); a mixed order with ready items waits for every design. Order status follows: awaiting_proof, proof_sent, revision_requested, approved.
- **Order status machine** (`order_set_status`): a single list of legal moves, mirrored in TypeScript and checked by a test against the SQL for all 196 pairs. Production cannot begin for a custom order before approval; cancelling releases stock. Moving to in production, out for delivery or delivered emails the customer and returns a WhatsApp link for staff (the Phase 6 production board calls this).
- **Account** (`/account`): orders (including ones placed as a guest with the same verified email), "a design proof is waiting" callout, store credit, saved addresses (first is default, edit, delete promotes another), wishlist (heart on every product page, sign-in prompt for visitors), profile.
- **Reviews and store credit**: verified buyers only (private order link or signed-in owner), delivered orders only, one review per item, up to 3 photos (private signed upload to a public review-photos bucket, images only). Reviews start pending. Approving a **photo** review grants ₦2,000 once; a guest who is not yet an account gets the credit the moment they sign up with that email.
- **Reminders** (`/api/cron/reminders`, hourly at :30): the abandoned-checkout email 1 hour after an unpaid order, and the review request 3 days after delivery. Both once per order, never for paid, expired or digital-only orders.
- **Resume payment**: an unpaid order's page has "Complete payment". It issues a new Paystack reference; the old one still settles the order if the customer actually finished it, and paying twice is detected and flagged "Refund needed".
- **Emails** now: proof ready, proof approved, in production / out for delivery / delivered, review request, abandoned checkout, plus a sign-in email template (6 render tests).
- **Dev-only login** (`/api/dev/login`) so accounts and the staff/admin gates can be tested on local Postgres. It only exists when running against a plain Postgres URL and returns 404 otherwise.

## Phase 5 decisions

43. **Digital orders (gift cards, extra revisions) finish immediately** as `delivered` with no promised date, so they do not appear as something to ship or get a review request.
44. **Payments are matched through the payment record**, not just the order's current reference, so a late payment on an older reference still settles the right order.
45. **Proof images** are private: customers get 1-hour signed links (Supabase). In local dev, proof paths starting with "/" are served as plain files.
46. **The proof "Approve" button is a form post, not a link in the email.** The email links to the order page, so scanners or previews that open links can never approve a design by accident.
47. **Order page access** uses the private token in the link (anyone with the link can view and answer proofs, like a courier tracking link) or the signed-in owner. The Supabase "magic link" email itself is sent by Supabase Auth: paste the template from `emails/sign-in-link.tsx` into Authentication > Email Templates (see README).
48. **Bugs found by the browser run and fixed**: success messages disappearing when the page refreshed after an action (proofs, reviews); the bag drawer staying open over the checkout after "Buy an extra revision"; form fields wiped after a validation error (account addresses and profile, same fix as Phase 3); and "Leave a review" offered on digital-only orders.
49. **Vercel crons**: two hourly jobs now (`expire` and `reminders`). Hobby plans only allow daily crons, so use Pro or change both schedules to daily.
50. **Staff screens for proofs/reviews are Phase 6.** The back end (`sendProof`, `moderateReview`, `changeOrderStatus`) is built, tested and waiting for them.

## Phase 6: what exists

- **Roles, enforced four times.** Admin pages call `requireStaff` / `requireAdmin` on the server; every server action re-checks; every database function re-checks the actor's role itself (`_require`); and the tables keep their RLS policies. Staff get orders, production, proofs, quotes, reviews and customers; admins also get catalogue, discounts, reports and settings. A staff user who opens an admin-only URL is sent back to the dashboard with a notice, and a staff write to an admin function is refused by the database (tested directly).
- **Overview:** today and this week's revenue, orders, average order, share of orders with a bundle, checkout-to-paid conversion (admins only); due in 48 hours, at risk of missing the promise (highlighted), proofs waiting and late against each tier's promise, low stock, new quotes, reviews to approve, refunds needed.
- **Orders:** search by number, name, phone or email; filter by status, zone, custom, promised dates; phone cards and desktop table. Order detail: every item including all bundle selections and custom briefs and customer uploads, address, payment records, timeline (with who did what), internal notes, one-click status moves (customer emailed for in production / out for delivery / delivered), WhatsApp update button, printable packing slip (no prices), refund recording (record only; the money goes back in Paystack).
- **Production board:** columns Ready to start, In production, Quality check, Packed, Out for delivery, Delivered (7 days); sorted by promised date; red when due within 24 hours; tick several orders and move them together, with illegal moves reported.
- **Proofs queue:** brief, uploads, wait time versus the 12/24/48h promise, upload a proof image and send it (customer emailed, optional WhatsApp link). "Waiting on the customer" list.
- **Bulk quotes:** New / Quoted / Won / Lost, quoted amount, and "turn into an order": an unpaid order with a 7-day payment link, emailed to the customer.
- **Reviews:** approve or reject; approving a photo review grants store credit once.
- **Customers:** orders, lifetime spend, last order, store credit, has account; search; CSV export (formula-safe).
- **Catalogue (admin):** products (details, SEO, visibility), photos (upload, reorder, alt text required), variants (price override, visibility, bulk colour x size x option generation that never touches existing ones), stock adjustments with a required reason and a log, designs, collections, bundles with slot rules (allowed designs, fixed product, size/colour/option needs, matching groups, printed names, availability window in Lagos time).
- **Discounts (admin):** codes with percentage or fixed value, minimum spend, dates, total and per-customer limits; ambassadors with a personal 10% code, sales, commission owed and "mark as paid".
- **Reports (admin):** date range, sales by day (chart plus table), best-selling designs, products, bundles, collections, delivery zones and ambassador codes; CSV for each.
- **Settings (admin):** announcement bar, logo upload, WhatsApp number and social links, add-on prices, extra revision fee, review credit, the bag offer, delivery zone fees, free-delivery threshold, delivery days and Christmas cutoffs, maintenance mode.
- **`/admin/help`:** the owner's guide (staff and admins see their own version).
- **Uploads:** staff upload proofs and admins upload photos and the logo through short-lived signed URLs (Supabase) or, in local dev only, to `public/uploads`.

## Phase 6 decisions

51. **Admin work goes through database functions that take the actor's id and check the role inside the database**, in addition to the page and action gates. This also lets the whole admin run, and be tested, on a plain local Postgres.
52. **Local Postgres mode now reads the catalogue and settings from the database**, so admin edits show on the store immediately. (The fixture is only used when there is no database at all.)
53. **Messages after an item moves lists** (proof sent, quote converted, review decided) travel in the page address as a banner, because the card that held the message is gone after the move.
54. **Forms keep what you typed after an error.** React 19 clears a form after any server action; the admin forms put your values back when the action fails, and the account and public forms echo values back as before.
55. **Refunds are recorded, not performed** (as specified). Orders paid twice or paid after expiry are flagged "Refund needed" on the overview and the order.
56. **The print partner is not part of the admin**, as you asked: no partner email, no work-order screen. The packing slip is for your own team.
57. **Maintenance mode** replaces the storefront pages with a "back soon" notice and makes checkout refuse new orders; the admin and the payment webhook keep working. Static pages pick the change up within about five minutes.
58. **A won bulk quote is an unpaid order the customer pays online**, with a 7-day link (normal orders expire after 24 hours), delivery fee included in the quoted total.
59. **Reports count paid, non-cancelled, non-refunded orders by the day they were paid in Lagos time.** Item-level revenue (designs, products) is before discounts; the totals are what customers actually paid.

## Acceptance tests: current coverage

| Part 7 acceptance test | Status |
|---|---|
| Guest buys a tee with a code, pays, correct total, 5-day promise | Covered (`e2e/checkout.spec.ts`, integration) |
| Couple's Christmas Box selections in the bag, order, **admin view** and email | Covered: the admin order page and packing slip list every slot (admin run) (the print partner email does not exist by your decision) |
| Custom text design: pay, awaiting proof, **admin uploads a proof**, customer revises, admin sends the second, customer approves, and only then the promise is set | Covered end to end, including the admin proof upload (`e2e/admin.spec.ts`, `e2e/post-purchase.spec.ts`) |
| Browser price tampering does not change the charge | Covered |
| Fake/replayed webhook rejected, duplicate does not double-process | Covered over real HTTP in the browser suite (`e2e/payments-and-cutoff.spec.ts`: no/wrong signature 401, wrong amount not paid, duplicates change nothing) and in `webhook.test.ts` |
| After a zone's Christmas cutoff gift box pages show the notice and checkout warns | Covered in the browser (`e2e/payments-and-cutoff.spec.ts`: the admin moves the Lagos cutoff to yesterday, the gift-box page shows the notice and checkout shows the warning) and in unit tests |
| Ambassador code gives 10% and creates a pending commission | Covered, plus admin "mark as paid" |
| **Staff cannot open settings, discounts or reports** | **Covered:** browser (redirected from every admin-only page and CSV) and database (every admin-only function refuses staff) |

## Known gaps

- **Largest Contentful Paint** is under 2.5 s in the lab only on the collection page; home and product are 2.7 to 3.6 s on Lighthouse's simulated slow 4G (see Phase 7). Re-measure on the real Vercel deployment.
- **Rate limiting is in-memory per instance** (decision 10); swap for Upstash/Vercel KV before heavy traffic.
- **Refunds are recorded, not performed** (decision 55); issue them in the Paystack dashboard.
- Tests that need your accounts cannot run here: a real Paystack test payment, a real Resend delivery and a real Supabase project. They are in [LAUNCH.md](./LAUNCH.md).

## What the project owner still needs to supply

Supabase project URL + anon + service-role keys, Paystack test then live keys, Resend key and verified domain, your domain, the real WhatsApp number, Instagram and TikTok links, the logo (upload in admin), and real product photos.

## Phase 7: what exists

- **Performance pass.** Measured with Lighthouse 12 (mobile, simulated slow 4G, 4x CPU) against a production build. Fixes: the naira sign (U+20A6) lives in the Latin-extended subset of Inter and Anton, which pulled an 86 kB font file onto every page behind the stylesheet; it is now served from a local system font through a one-glyph `@font-face` (`app/globals.css`). Above-the-fold hero and product images load eagerly with high fetch priority (they were lazy). The home hero no longer fades in from opacity 0 (it delayed the largest paint). Product cards render the back view only when someone hovers, focuses or taps (halves the DOM on listing pages). The mobile "Add to bag" bar is sticky inside the page so it never covers the footer. Added a favicon (it was a console 404). Final scores, median of repeated runs: **home 94, collection 91 to 95, product 87 to 92**; accessibility 99 to 100, best practices 96 to 100, SEO 100; CLS 0; TBT 130 to 280 ms; LCP 2.3 s (collection), 2.7 to 3.0 s (home), 3.3 to 3.6 s (product). **Honest summary:** performance is at or near 90 on all three but product pages sit right on the line and LCP is above 2.5 s on home and product in this simulation. The remaining cost is 103 kB of shared JavaScript (React and the Next runtime) plus font files. Real-world numbers on Vercel's CDN will differ; re-measure the live URL (LAUNCH.md).
- **Cookie consent and analytics.** `lib/consent.ts` (choice plus timestamp in the browser), `components/consent/*` (banner with Accept all, Essential only, Customise; "Cookie settings" in the footer; withdrawing consent reloads without the tools). `lib/analytics.ts` loads GA4 (`NEXT_PUBLIC_GA_ID`) and Meta Pixel (`NEXT_PUBLIC_META_PIXEL_ID`) only after consent and sends `view_item`, `add_to_cart`, `begin_checkout` and `purchase` in NGN (also to Vercel Analytics). Analytics consent covers GA4 and Vercel Analytics; marketing consent covers Meta Pixel. `purchase` fires once per order per device. The privacy page lists exactly what is collected.
- **First-order offer.** Popup after 20 seconds or desktop exit intent, once per device, never on checkout, order, account, bag, sign-in or track pages, and only after the cookie banner is answered. Email or Nigerian phone. Migration `0013_offers.sql` adds `offer_claim`: stores the subscriber with `consent_at`, mints a `PEM-XXXXXX` single-use 10% code (60 days, `usage_limit` 1), returns the same code on a repeat claim. The code is emailed (`emails/welcome-offer.tsx`), auto-applied to the bag, and works through `/bag?code=...` from the email. The footer newsletter form now uses the same function.
- **Security.** Strict nonce CSP with `strict-dynamic` for admin, account, checkout, order and auth routes (`lib/csp.ts`, `middleware.ts`); public static pages keep a locked-down policy that allows inline scripts for hydration (a per-request nonce would force every catalogue page to render dynamically). HSTS, nosniff, frame denial, referrer and permissions policies on every route. Verified in the browser: no CSP violations across browsing, consent, checkout with the payment popup, and the admin.
- **ESLint 9** flat config (`eslint.config.mjs`) with `next/core-web-vitals` and `next/typescript`; one real error (a raw `<a>` link) and two unused variables fixed; `npm run lint` is clean.
- **Accessibility.** axe-core (WCAG 2.0 and 2.1 A and AA) scans 14 public pages on mobile and desktop, the open bag drawer and 12 admin pages. It found three real issues, all fixed: low contrast on the bulk page "what happens next" list, an `aria-label` on a plain `div` in the bag loading state, and an unlabelled file input in the admin uploader.
- **SEO.** Unique titles, descriptions, canonicals, Open Graph and exactly one `h1` on 10 sampled pages; Product + Offer JSON-LD (NGN) and breadcrumbs; sitemap excludes private pages; robots blocks them; private pages are `noindex`; unknown slugs return a real 404. Added a default Open Graph image (`/og/pemart`) for pages without their own, and to collection pages.
- **Browser test suite.** `@playwright/test` (`npm run test:e2e`, `playwright.config.ts`, `scripts/e2e.sh`): 21 tests in `e2e/` against `next dev` and a throwaway Postgres: `checkout`, `post-purchase`, `admin` (the earlier walk-through scripts, ported), `payments-and-cutoff` (signed webhook over HTTP, duplicates, wrong amount; cutoff notices), `storefront` (consent and events, offer, SEO, axe, CSP). Runs in about 10 minutes.
- **Housekeeping.** README rewritten (local setup, Supabase, Paystack test and live, Resend domain, Vercel deploy, adding products and bundles, tests, env vars), `LAUNCH.md` checklist, `.env.example` finalised, unused `components/coming-soon.tsx` removed.

## Phase 7 decisions

60. **The naira sign is served from a system font** (Arial, Roboto, Helvetica, and so on) instead of Inter or Anton, to avoid an 86 kB download. If a device has none of them the browser falls back to the web font, so it still renders.
61. **Analytics consent is two-way, not one switch:** analytics (GA4, Vercel Analytics) and marketing (Meta Pixel) are separate choices, because they have different purposes.
62. **Nonce CSP only on dynamic sensitive routes.** Static catalogue pages cannot carry a per-request nonce, so they keep `'unsafe-inline'` scripts. The trade-off is that a page with an XSS bug on the public side would be less protected than on the sensitive side; nothing user-controlled is rendered there unescaped.
63. **The popup, footer sign-up and email all share one SQL function (`offer_claim`).** One contact gets one code, ever; re-signing up shows the same code, or says it has been used. Phone-only claims show the code on screen since there is no email.
64. **The offer popup waits for the cookie banner.** Two overlays at once is hostile on a phone, so the 20-second timer only starts once the visitor has answered the banner.
65. **The browser tests use `next dev`** because the simulated payment popup, the local database mode and the dev sign-in are all refused in production mode by design.

## Acceptance tests: final coverage (Phase 7)

All eight are automated: see the table above. Totals: 113 unit tests, 77 integration tests against real Postgres, 21 browser tests, TypeScript (app and tests) and ESLint clean.
