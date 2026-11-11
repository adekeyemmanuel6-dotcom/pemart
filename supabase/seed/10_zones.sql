-- Delivery zones. Fees and cutoff dates are editable in admin (Settings > Delivery).
insert into public.delivery_zones (name, states, fee_kobo, free_over_kobo, lead_days, christmas_cutoff_date, sort_order) values
  ('Lagos', '{Lagos}', 350000, 7500000, 5, '2026-12-17', 1),
  ('South-West', '{Ogun,Oyo,Osun,Ondo,Ekiti}', 550000, null, 5, '2026-12-15', 2),
  ('Other states',
   '{Abia,Adamawa,"Akwa Ibom",Anambra,Bauchi,Bayelsa,Benue,Borno,"Cross River",Delta,Ebonyi,Edo,Enugu,"FCT (Abuja)",Gombe,Imo,Jigawa,Kaduna,Kano,Katsina,Kebbi,Kogi,Kwara,Nasarawa,Niger,Plateau,Rivers,Sokoto,Taraba,Yobe,Zamfara}',
   750000, null, 5, '2026-12-15', 3);
