-- Healthy Cola: switch to 250 ml cans and the two new offers.
-- Run in Supabase SQL Editor (service role / admin). The public anon key cannot update offers because of RLS.
begin;

update public.offers set
  name = 'عرض الـ 30 كانز',
  badge = '⭐ الأكثر توفيرًا',
  description = '30 كانز Healthy Cola (250 مل) — 6 نكهات من اختيارك',
  note = 'أوفر سعر — 30 كانز بـ 600 جنيه بدل 725.',
  price = 600,
  original_price = 725,
  units = 30,
  units_label = '30 كانز',
  flavors = '[
    {"id":"cola","name":"كولا","group":"cola","is_active":true},
    {"id":"pineapple","name":"أناناس","group":"cola","is_active":true},
    {"id":"lemon","name":"ليمون نعناع","group":"cola","is_active":true},
    {"id":"orange","name":"برتقال","group":"cola","is_active":true},
    {"id":"greenApple","name":"تفاح أخضر","group":"cola","is_active":true},
    {"id":"mixBerries","name":"توت مشكل","group":"cola","is_active":true}
  ]'::jsonb,
  image_url = null,
  accent = '#6B21A8',
  delivery_note = 'الشحن يُحدد مع الكول سنتر',
  free_shipping = false,
  shipping_mode = 'call_center',
  shipping_fee = null,
  is_active = true,
  sort_order = 1
where site = 'cola' and slug = 'summer';

update public.offers set
  name = 'عرض 5 + 1 هدية',
  badge = '🎁 الكانز السادسة هدية',
  description = 'اشتري 5 كانز Healthy Cola (250 مل) واحصل على الكانز السادسة هدية',
  note = '5 كانز + كانز هدية — جرّب كل النكهات.',
  price = 125,
  original_price = 150,
  units = 6,
  units_label = '6 كانز',
  flavors = '[
    {"id":"cola","name":"كولا","group":"cola","is_active":true},
    {"id":"pineapple","name":"أناناس","group":"cola","is_active":true},
    {"id":"lemon","name":"ليمون نعناع","group":"cola","is_active":true},
    {"id":"orange","name":"برتقال","group":"cola","is_active":true},
    {"id":"greenApple","name":"تفاح أخضر","group":"cola","is_active":true},
    {"id":"mixBerries","name":"توت مشكل","group":"cola","is_active":true}
  ]'::jsonb,
  image_url = null,
  accent = '#DC2626',
  delivery_note = 'الشحن يُحدد مع الكول سنتر',
  free_shipping = false,
  shipping_mode = 'call_center',
  shipping_fee = null,
  is_active = true,
  sort_order = 2
where site = 'cola' and slug = 'combo';

-- Hide the old 12-can offer. Delete it instead if you do not need its history.
update public.offers set is_active = false where site = 'cola' and slug = 'month';
-- delete from public.offers where site = 'cola' and slug = 'month';

select slug, name, price, original_price, units, is_active, shipping_mode,
       jsonb_array_length(flavors) as flavor_count
from public.offers
where site = 'cola'
order by sort_order;

commit;
