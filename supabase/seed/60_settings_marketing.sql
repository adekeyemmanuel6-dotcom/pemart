-- Store settings. Social links and the WhatsApp number are PLACEHOLDERS: update in admin.
insert into public.settings
  (announcement_text, announcement_link, announcement_active, upsell_product_id, upsell_price_kobo,
   gift_wrap_kobo, surprise_note_kobo, express_kobo, express_enabled,
   whatsapp_number, instagram_url, tiktok_url)
values
  ('Order by 17 Dec for Christmas delivery in Lagos', '/gift-boxes', true,
   (select id from public.products where slug = 'faith-bracelet'), 450000,
   200000, 300000, 500000, true,
   '2340000000000', 'https://instagram.com/pemart', 'https://tiktok.com/@pemart');

-- Demo codes for development and tests. Remove or change before launch.
insert into public.ambassadors (name, email, code, commission_rate, payout_note)
values ('Demo Ambassador', 'ambassador@example.com', 'GRACE10', 0.10, 'Demo only');

insert into public.discount_codes (code, type, value, min_spend_kobo, ambassador_id, usage_limit)
values ('PEMART10', 'percentage', 10, 0, null, null);

insert into public.discount_codes (code, type, value, min_spend_kobo, ambassador_id)
values ('GRACE10', 'percentage', 10, 0, (select id from public.ambassadors where code = 'GRACE10'));
