-- Switches the Normal T-shirt back off (the 0024 starting state). Combos stop offering it at once.
update public.combo_components set is_active = false where slug = 'normal-tshirt';
