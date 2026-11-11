# Launch checklist

Tick every box before you point the real domain at the site. Setup steps are in [README.md](./README.md).

## Accounts and keys
- [ ] Supabase project created in a nearby region; migrations `0001` to `0013` and `seed.sql` applied; Advisors show no RLS warnings
- [ ] Auth Site URL and Redirect URLs set to the live domain (`/auth/callback`); Google sign-in enabled if you want it
- [ ] You can sign in and `supabase/make-admin.sql` made you admin; staff accounts added
- [ ] Paystack business verified; **live** keys set; **live** webhook URL `https://DOMAIN/api/webhooks/paystack` saved
- [ ] One real small purchase made, seen as **Paid** in `/admin/orders`, then refunded
- [ ] Resend domain **Verified**; `EMAIL_FROM` on that domain; a test order email reached a Gmail and an Outlook inbox (check spam too)
- [ ] `CRON_SECRET` set; both cron jobs show in Vercel > Settings > Cron Jobs (daily on the free plan; switch to hourly on Pro)
- [ ] `PAYSTACK_MOCK` and `DATABASE_URL` are **not** set in Production
- [ ] After changing any `NEXT_PUBLIC_*` value, the site was redeployed

## Content (admin)
- [ ] Logo uploaded in *Settings*
- [ ] Real product photos with alt text replace the demo artwork where you have them; stock levels counted
- [ ] Prices, bundle prices and slots checked; every gift box shows the right Christmas window
- [ ] Delivery fees, free-delivery threshold and **Christmas cutoff dates** per zone are correct for this year
- [ ] Announcement bar text, WhatsApp number (international format, e.g. `2348031234567`) and gift wrap/express fees set
- [ ] About, FAQ, delivery, returns, terms and privacy read through; your contact details and company name are correct
- [ ] Discount codes and ambassador codes created (the old demo `PEMART10` and `GRACE10` removed or changed)
- [ ] Instagram and TikTok links added in *Settings* when you have them (they then appear in the footer)

## Tests on the live URL (phone, on mobile data)
- [ ] Browse home > collection > product; add to bag; checkout as a guest; pay; see the order page and email
- [ ] The cookie banner appears; "Essential only" loads no trackers; "Accept all" starts GA4 and Pixel (check *Realtime* in GA4 and *Test events* in Meta)
- [ ] `purchase` shows once per order in GA4
- [ ] Custom design: order, receive the proof from the admin, approve; delivery date appears
- [ ] Couple's Christmas Box: every choice (designs, sizes, perfumes, bracelets, orb) and the gift message show in the order, the email and the admin
- [ ] Track an order from `/track` with order number plus phone/email
- [ ] First-order popup appears once, issues a `PEM-` code, applies it, and the code works only once
- [ ] Create an account with email + password, confirm the email, sign out, sign in, use *Forgot password*, and try Google; the account shows orders, addresses, wishlist
- [ ] Auth emails (confirm, reset) come from your own name and domain (Supabase > Authentication > SMTP Settings), not from Supabase
- [ ] Staff login cannot open Settings, Discounts, Reports or Catalogue

## Performance, accessibility, SEO
- [ ] Lighthouse (mobile) run on home, a collection and a product: performance 90+, accessibility 95+, SEO 100. LCP under 2.5 s on a real 4G phone
- [ ] `npm run test:e2e` passes against the same code (includes axe WCAG 2.1 AA scans)
- [ ] View source of a product page: title, description, canonical, Open Graph image, Product JSON-LD in NGN
- [ ] `https://DOMAIN/sitemap.xml` and `/robots.txt` load; submit the sitemap in Google Search Console
- [ ] Share a product link on WhatsApp and check the preview card

## Security and privacy
- [ ] Response headers on the live site include `Strict-Transport-Security` and a `Content-Security-Policy` (check with browser dev tools > Network)
- [ ] No CSP errors in the browser console on checkout, the order page or the admin (a blocked third-party script would show here)
- [ ] The privacy page matches what you actually collect and which tools you switched on
- [ ] Customer uploads and proofs are private (open one of their storage URLs without a signed link: it must be refused)
- [ ] Only people who should be admins are admins (`select email, role from profiles where role <> 'customer'`)

## Operations
- [ ] Someone checks `/admin` at least twice a day during Christmas; `/admin/help` read by everyone who will use it
- [ ] Paystack settlement account and bank details confirmed
- [ ] You know where to look when something fails: Vercel > Logs (payment and webhook events are logged as structured JSON), Supabase > Logs, Resend > Emails

## Known limits to revisit as you grow
- **Rate limiting** (forms, checkout, search, uploads) is in-memory per server instance. It stops casual abuse, but on Vercel each instance counts separately. Before heavy traffic, swap the store in `lib/rate-limit.ts` for Upstash/Vercel KV (the function signature stays the same).
- **Lighthouse figures** in PROGRESS.md come from a lab run on a development machine with simulated slow 4G; real-world numbers on Vercel's CDN will differ. Re-measure on the live URL.
- **Real product photography** will be larger than the bundled SVG art; product images already go through `next/image`, so upload sensible sizes (about 1600 px on the long edge).
