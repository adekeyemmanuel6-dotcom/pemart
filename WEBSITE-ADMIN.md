# Website administration

Open `/admin/website` as an administrator. The Overview page and admin navigation both link to it. Staff accounts retain their operational access and cannot publish site content.

## What you can change

- Brand name, byline, footer copy, copyright, maintenance message, search titles/descriptions, sharing image, colour palette and heading style.
- Twelve homepage sections: copy, images, button labels/destinations, visibility and display order. The hero remains enabled. Featured products can be selected and ordered explicitly, or left on catalogue ranking.
- Main menu, shop menu, help links and footer legal links, including labels, destinations and ordering. The same main/shop menus are used on phones.
- The five brand collection cards: display names, descriptions, images, ordering and visibility. Product assignment stays in Catalogue. Stable addresses and existing product IDs are preserved.
- Community photographs with descriptions, captions, ordering and confirmation of publication permission.
- About, FAQ, Contact, Delivery, Returns, Terms, Privacy and Size Guide content. Original pages stay in place until edited content is enabled. New information pages use `/pages/your-address`; add them to Navigation when ready. Enabled custom pages enter the sitemap.

Product prices, variants, inventory, product images, designs and bundles remain in Catalogue. Logo, contact/social details, announcements, delivery services, fees and maintenance status remain in Settings. Discount campaigns remain in Discounts.

## Editing and publishing

Edits remain in the open editor until **Publish changes** succeeds. **Preview content** shows unsaved content for the selected tab; it is a content preview, not a complete simulation of checkout or product grids. **Discard changes** restores the last publication loaded in this editor. Unsaved edits warn before refresh or following a link away.

Page text supports paragraphs, `## headings`, `- list items` and `[link text](/contact)`. Raw HTML is displayed as text. Upload images to the existing catalogue storage bucket; local site image paths and public Supabase Storage image URLs are accepted. Uploaded images can be removed from a field without deleting the storage object used elsewhere.

Publishing validates the full content, checks the current administrator session and database role, saves only website content, increments a revision and invalidates the storefront cache. A stale editor cannot overwrite a newer publication; compare the newer version in a separate tab and reapply the intended edits. Failed publication leaves the current form intact.

Published website content is public data, including disabled page records; this is not a private document store. Disabled existing pages fall back to their original content. Disabled new pages return 404.

## Release requirements

The prepared, unapplied `0014_wear_the_word.sql` migration now includes `settings.website_content`, `settings.website_revision` and the service-role-only `admin_website_save` RPC. Existing RLS policies remain enabled, and the RPC rechecks the supplied server-verified actor's admin role. It rejects stale revisions, invalid JSON shapes and oversized content. The normal settings editor cannot overwrite these columns.

This migration also contains the earlier checkout changes. Do not apply the whole migration separately to the current old storefront while Preview deployment is failing. Existing delivery prices and five-day estimates are explicitly **unverified** and must remain pending. Production promotion still requires a successful Vercel build and the release checks in MIGRATION-REVIEW.md.

The temporary local QA route is not part of the source release. No payment credentials, RLS policies, customer/order IDs or production data are changed by editing website content.

Existing contact channels and fit measurement tables remain available alongside edited Contact and Size Guide content.
