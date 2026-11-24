# Words and garments: admin guide

Each **word** is a Design (Admin → Catalogue → Designs). Each garment of that word is its own **product**:

| Product | Type | Quality |
| --- | --- | --- |
| Through Christ That Strengthens Me, Normal T-shirt | T-shirt | Normal |
| Through Christ That Strengthens Me, Premium T-shirt | T-shirt | Premium |
| Through Christ That Strengthens Me, Sweatshirt | Sweatshirt | (none) |
| Through Christ That Strengthens Me, Hoodie | Hoodie | (none) |

## Set up (once)
Apply `supabase/migrations/0026_sweatshirt_quality_colour_images.sql` in the Supabase SQL editor (safe to re-run; changes no existing product, photo or order). Rollback: `supabase/rollback/0026_sweatshirt_quality_colour_images.sql`.

## Add a garment of a word
1. Admin → Catalogue → Products → New product. Pick the **Type** (now includes *sweatshirt*), choose the word under **Design**, and for T-shirts set **Quality** (Normal or Premium). Quality shows as a label on the product page and a "Premium" tag on cards.
2. Set the price, then **Create combinations**: type the colours and sizes (every colour × size is created, each with its own stock).
3. **Photos**: upload photos of that exact garment with that word. Each photo has a **colour** setting. "All colours" photos always show; a colour-only photo shows when the customer picks that colour (that colour's photos come first). Upload at least one photo per colour.
4. Set the status to **Active** when it is ready (new products start as drafts).

Tip: duplicate the product name pattern ("<Word>, Premium T-shirt") so customers can tell them apart in search and the bag.

## Notes
- Combos (Behold, Abide, The Doer's) are separate and unchanged; they have their own garment choices under Combo Management.
- CSV import accepts the new type `sweatshirt`. Quality and photo colours are set in the admin screens, not the CSV.

## Word pages (step 2)
- **Shop by Word** (`/words`) lists every word that has at least one product on sale, with how many garments it comes in and the lowest price. It is linked from the Shop menu and the sitemap.
- **A word's page** (`/words/<word>`) shows the word's verse and story, then every garment grouped as T-shirts (Normal before Premium), Sweatshirts and Hoodies. Nothing to set up: it builds itself from the products you attach to the word. A word with no active products has no page.
- Each product page has a **"See this word in every garment"** link back to it.
- Set the word's name, verse reference and story under Admin → Catalogue → Designs; they show on the page.

## Choose your word in combos
In the combo calculator, any garment or frame that allows the customer's own text now also offers **"Word for the garment / frame"**, listing your active words. They can pick one, write their own words, or both. The choice never changes the price. It is shown in the bag and kept on the order (with the word's id), the order page, packing slip and emails.
- Switching a word off (Designs → inactive) removes it from the list straight away, and refuses a bag that still contains it.
- Needs `supabase/migrations/0027_combo_words.sql` (apply after 0026; rollback in `supabase/rollback/0027_combo_words.sql`).

## Your word catalogue (migration 0030)
`supabase/migrations/0030_word_catalogue.sql` creates your words and frames. **Run it in the Supabase SQL editor.** Until you run it, the catalogue only shows the old demo products.

**On T-shirts (Normal and Premium), sweatshirts and hoodies:**
Jesus is King (Revelation 19:16) · Faith Over Fear (Psalm 118:6) · Na God Dey Run am (Psalm 37:5) · No be Luck, Na Grace (Ephesians 2:8) · Daily Loaded with benefits (Psalm 68:19) · No Longer a Slave to Sin (Romans 6:6) · Jesus No dey Fail (Hebrews 13:8) · Sin Has No Hold Over me (Romans 6:14)

Each word gets four products (Normal T-shirt, Premium T-shirt, Sweatshirt, Hoodie), each in **Black, White, Royal Blue, Army Green, Yellow, Navy Blue, Pink, Brown** and **S, M, L, XL, XXL**: 32 products, 1,280 variants, made to order.

**Frames** (sizes 12 × 16 and 16 × 20 inches, to match the combos): Faith Over Fear (Psalm 118:6) · I Can Do All Things Through Christ (Philippians 4:13) · The Light Shines In the Darkness (John 1:5) · Saved by Grace Fueled by Faith (Ephesians 2:8-9) · He left the 99 to find me (Luke 15:4) · Scriptures on Business (Proverbs 16:3) · Scriptures on Finances (Philippians 4:19) · Scriptures on Favour (Psalm 5:12) · Scriptures on Health (3 John 1:2) · Scriptures on Strength (Isaiah 40:31). 10 frame products.

**Please check the verses.** The verse for each word is my choice (King James text); change any of them under Admin → Catalogue → Designs. The five "Scriptures on …" frames each use one anchor verse; if a frame should carry several scriptures, edit its design's text.

**What the migration does**
- Everything is a **draft with a price of ₦0**. A garment or frame **cannot be made Active while its price is ₦0**.
- It **archives the old demo tees, hoodies and frames** (kept for past orders, restorable from the product's Status). Products that gift boxes or couple packs still use are left alone, and accessories, gift cards and combos are untouched.
- It removes the draft garments of an earlier version of this set, if you ran it.
- Safe to re-run: it never duplicates or overwrites a price, photo or text you changed. To change words, verses, colours or sizes, edit the lists at the top of the file first.

### What you do next, per product
1. **Price**: the fastest way for 42 products is Catalogue → Export products (CSV), fill the `price` column, then Import. Import updates existing products by slug.
2. **Photos**: open the product and scroll to **Photos**. There is a section for **each colour** (Black, White, …) plus **All colours**. Use "Add a photo for White" in the White section, and so on. When a customer clicks a colour, the photos switch to that colour's photos. A colour with no photo yet shows the "All colours" photos. (Size does not change the photo.)
3. **Status → Active**, then Save. It then appears on the word page (`/words/<word>`) and in the shop.

To find the new products in the admin: Catalogue → Products → Status → Draft.

## Selecting many products at once (migration 0031)
Apply `supabase/migrations/0031_catalogue_bulk.sql` (rollback: `supabase/rollback/0031_catalogue_bulk.sql`). Then, in Admin → Catalogue → Products:
- Tick products, or tick the box in the table header to **select all shown** (the status tabs and the search narrow what is shown first, so "all shown" means just those).
- **Set status**: Active, Draft or Archived for everything selected.
- **Same price for selected**: one price for all selected products (must be above ₦0), for example all Premium T-shirts.
- **Delete archived**: permanently deletes the selected products that are **Archived**. It asks you to tick a confirmation box and confirm again. Active and draft products are never deleted by it, and an archived product that is on a past order is kept (so old orders stay readable). Photos and variants of a deleted product are deleted with it.
