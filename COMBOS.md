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
3. **Items**: each accessory can have its own selling price (**Selling prices → "Prices of the other items"**). An included item with a price adds it to the package price; an included item left empty is free. Optional items add their price when the customer chooses them.
4. Only **one** discount applies (the largest active). Discount codes at checkout apply afterwards.
Prices are always recomputed on the server from published data at bag, checkout and payment time; the browser never sets a price.

## Drafts, publishing and orders
Customers only ever see the last **published** version. Edits stay private until you publish again. Orders store a full snapshot of what was bought, so later edits, archiving or price changes never alter past orders.

## Couples editions (two garments)
Each collection can have a **couples edition**: the same contents (frames, diary, pens and so on) but **two garments**, one for each person, each with their own garment, colour and size.
- Apply `supabase/migrations/0028_combo_couples.sql` (after 0026 and 0027). It creates a **draft couples edition of Behold, Abide and The Doer's** with the garments doubled and **no selling price**. Rollback: `supabase/rollback/0028_combo_couples.sql`.
- In **Combo Management** every collection has a **Make couples edition** button (one edition per collection). Edit it like any combo: the **Number of garments** field in Package contents is the only difference.
- Set its **base price**. The price is base + each garment's extra (a hoodie and a T-shirt are priced one by one; two hoodies pay the hoodie extra twice) + the frame-size extras. Fixed prices are not available for two-garment packages. Costs and overheads are set separately for the edition.
- Publish both editions. In the calculator, a collection with a published couples edition shows **Just me / For two (couples)**; `/combos` shows one card per collection with a "Couples edition from ₦…" link, and the couples page links back to the single edition.
- The order keeps both garments, with the colour, size and word each person chose.
- The older couple's bundle is untouched; you can link it to an edition under Details → "Replaces this older bundle".

## The website follows your collections
Once you publish them, the whole site is organised around **BEHOLD, ABIDE, THE DOER'S** and the **Couples Collection** (the couples editions of each):
- **Homepage:** a "Choose Your Collection" section right after the hero (and the manifesto strip, if shown). It **replaces the older "collections" section**, so the homepage never lists two sets. Then the calculator, as before.
- **Menu and footer:** the Collections menu and the footer Collections list show the same collections, in your order. (If you built a custom menu in Website editor → Mega menu, your menu is kept as you made it.)
- **`/couples`:** is the **Couples Collection** page, leading with the couples editions. The older couple packs, if you still sell them, follow under "More for couples".
- **`/combos`:** one card per collection, plus the Couples Collection.
- Nothing is listed until it is **published**, and a collection with no price says "Price currently unavailable".
- Words, picture and button text for the section, and the Couples Collection's name, line and picture, are under **Combo Management → Website text → "Homepage, menu and footer: your collections"**.

## Choosing the website fonts
**Website editor → Brand & SEO → "Fonts for the whole website".** Pick a **Heading font** and a **Paragraph font**, with a live sample, then Publish. This changes the shop your customers see (not the admin).
- Headings: Anton (the original), Bebas Neue, Oswald, Montserrat, Poppins, Playfair Display, Lora, Georgia, Arial.
- Paragraphs: Inter, DM Sans, Oswald, Montserrat, Poppins, Lora, Georgia, Arial. "Original" keeps the current look.
- The font files are bundled with the site (open-licence), so a choice adds no outside request, and visitors only download the font in use. The ₦ sign always renders correctly.
- Each homepage section can still override its own heading font under that section's Style.

## Pricing the accessories (The Doer's)
In a combo's **Selling prices** tab there is a card, **Prices of the other items**, listing every accessory in the package (diary, pen, highlight pen, sticky notes, perfume, and any extra you add):
- **Included items** (diary, pens…): enter the selling price and it is **added to the package price** and shown as its own line in the price breakdown. Leave it empty and the item is included free.
- **Optional add-ons** (perfume, cards…): the price customers pay if they choose to add it. Empty uses the item library price; with neither, customers cannot add it.
- Discounts and promotions apply to the total including the items. A fixed price for a garment + frame still gets the item prices added on top.
- The set price also shows on the combo page and in the calculator ("Included: 2027 Diary · ₦7,000"). Costs stay private in the Costs & profit tab.
Example: base price ₦30,000 + diary ₦7,000 + pen ₦1,500 = ₦38,500 (highlight pen and sticky notes free).
