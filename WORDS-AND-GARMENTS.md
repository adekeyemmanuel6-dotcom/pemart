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
