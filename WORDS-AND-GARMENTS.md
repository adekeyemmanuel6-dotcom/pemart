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
