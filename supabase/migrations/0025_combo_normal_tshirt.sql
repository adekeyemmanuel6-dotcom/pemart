-- The Normal T-shirt is a garment customers can choose in the combos. 0024 first seeded it switched off ("reference only");
-- switch it on, but only if it is still exactly as seeded, so a choice made in Admin > Combo Management > Item library is never undone.
update public.combo_components
   set is_active = true, description = 'Everyday cotton, 120–160 GSM.', updated_at = now()
 where slug = 'normal-tshirt' and is_active = false and archived_at is null
   and description = 'Everyday cotton, 120–160 GSM. Reference only: not offered in the combos.';
