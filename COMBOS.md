# Combo collections: admin guide

Combos (BEHOLD, ABIDE, THE DOER'S) are customisable packages. Everything is edited in **Admin > Combo Management**; no code changes are needed to change prices, frame counts or what is included.

## Set up (once)
1. Apply `supabase/migrations/0024_combos.sql` in the Supabase SQL editor (safe to re-run; it changes no existing data). Rollback: `supabase/rollback/0024_combos.sql`.
1b. Then apply `supabase/migrations/0025_combo_normal_tshirt.sql` (switches the Normal T-shirt on; it never overrides a change you made in the item library).
1c. Then apply `supabase/migrations/0027_combo_words.sql` (lets customers choose one of your words in the calculator).
2. The three collections are created as **drafts with no selling prices**. Nothing is public and nothing can be bought until you set prices and publish.
3. No new environment variables.

## Daily use
- **Item library** (`/admin/combos/library`): garments, frames and extras with their sizes/colours. Untick "Available" or mark "Out of stock" to hide an item from customers immediately, even on published combos. Archive instead of delete: past orders keep their details.
- **A combo** (`/admin/combos/<id>`):
  1. *Details*: name, theme line, scripture, picture, link to the older bundle it replaces.
  2. *Package contents*: add/remove/reorder items; set the number of frames (e.g. ABIDE = 3), which garments are allowed, included vs optional extras, "all frames same size".
  3. *Selling prices*: base price, garment extras, per-frame size extras, fixed prices for exact combinations, dated promotions. The preview table shows every price a customer can get.
  4. *Costs & profit* (owners only): reference costs and estimated margin. Never sent to the website or visible to staff.
  5. *Preview & publish*: fix any listed errors, **Save draft**, preview, then **Publish**. Unpublish any time.
- **Website text** (`/admin/combos/storefront`): header label, hero button, the homepage calculator and brand story sections, the `/combos` page.

Note: a garment with no "garment extra" costs the base price. If the Normal T-shirt should cost less than the Premium one, enter a negative extra (for example -5000) for it under Selling prices.

## Price rules (in order)
1. A **fixed price** for the exact garment + frame sizes replaces everything.
2. Otherwise **base price + garment extra + one extra per frame size**. No base price and no fixed price = "Price currently unavailable" and the combo cannot be added to the bag.
3. Optional extras add; included items are already in the package price.
4. Only **one** discount applies (the largest active). Discount codes at checkout apply afterwards.
Prices are always recomputed on the server from published data at bag, checkout and payment time; the browser never sets a price.

## Drafts, publishing and orders
Customers only ever see the last **published** version. Edits stay private until you publish again. Orders store a full snapshot of what was bought, so later edits, archiving or price changes never alter past orders.
