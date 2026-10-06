-- ============================================================================
-- Healthy & Tasty — Offers dashboard schema
-- الصق الملف ده كله في Supabase → SQL Editor → Run (مرة واحدة).
-- آمن لو اتشغّل أكتر من مرة (idempotent).
-- ============================================================================

-- ─── 1) الأدمن ───────────────────────────────────────────────────────────────
-- جدول فيه الـ user ids المسموح لها تكتب. مفيش policies عليه = محدش يقراه من برا.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ─── 2) العروض ───────────────────────────────────────────────────────────────
create table if not exists public.offers (
  id             uuid primary key default gen_random_uuid(),
  site           text not null check (site in ('cola', 'ice-cream', 'spread')),
  slug           text not null check (slug ~ '^[a-z0-9-]+$'),   -- ثابت: بيستخدمه كود الـ landing كـ bundle id
  name           text not null,
  badge          text,
  description    text,
  note           text,
  price          numeric(10, 2) not null check (price >= 0),
  original_price numeric(10, 2) not null check (original_price >= 0),
  units          int  not null default 1 check (units >= 1),
  units_label    text,
  -- [{ "name": "فانيليا", "image": "https://...(اختياري)" }]
  flavors        jsonb not null default '[]'::jsonb,
  image_url      text,
  accent         text not null default '#EC4899',
  delivery_note  text,
  free_shipping  boolean not null default false,
  is_active      boolean not null default true,
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (site, slug)
);

create index if not exists offers_site_sort_idx on public.offers (site, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- ─── 3) الأمان (RLS) ─────────────────────────────────────────────────────────
alter table public.offers enable row level security;

drop policy if exists "offers read" on public.offers;
create policy "offers read" on public.offers
  for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "offers admin insert" on public.offers;
create policy "offers admin insert" on public.offers
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "offers admin update" on public.offers;
create policy "offers admin update" on public.offers
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "offers admin delete" on public.offers;
create policy "offers admin delete" on public.offers
  for delete to authenticated
  using (public.is_admin());

-- ─── 4) تخزين الصور ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('offer-images', 'offer-images', true)
on conflict (id) do nothing;

drop policy if exists "offer images admin insert" on storage.objects;
create policy "offer images admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'offer-images' and public.is_admin());

drop policy if exists "offer images admin update" on storage.objects;
create policy "offer images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'offer-images' and public.is_admin());

drop policy if exists "offer images admin delete" on storage.objects;
create policy "offer images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'offer-images' and public.is_admin());

-- ─── 5) بيانات العروض الحالية (صفحة الآيس كريم) ───────────────────────────────
-- image_url فاضي عمداً: الـ landing بيرجع للصور المحلية لحد ما ترفع صور من الداشبورد.
insert into public.offers
  (site, slug, name, badge, description, price, original_price, units, units_label,
   flavors, accent, delivery_note, free_shipping, sort_order)
values
  ('ice-cream', 'icecream', 'عرض الآيس كريم', '🍨 5 قطع بـ 299 ج',
   'آيس كريم Healthy & Tasty بدون سكر — 5 قطع تختار نكهاتهم بنفسك من 8 نكهات: فانيليا، شوكولاتة، فراولة، مانجو، بلوبيري، فسدق، بندق، كنتالوب',
   299, 375, 5, '5 قطع',
   '[{"name":"فانيليا"},{"name":"شوكولاتة"},{"name":"فراولة"},{"name":"مانجو"},{"name":"بلوبيري"},{"name":"فسدق"},{"name":"بندق"},{"name":"كنتالوب"}]'::jsonb,
   '#EC4899', null, false, 1),
  ('ice-cream', 'ketobar', 'عرض الكيتو بار', '💪 4 قطع بـ 250 ج',
   'كيتو بار Healthy & Tasty — سناك بروتين من غير سكر · 4 قطع من 5 نكهات: بندق، زبدة فول سوداني، دبل شوكولاتة، جوز هند، لوز',
   250, 340, 4, '4 قطع',
   '[{"name":"بندق"},{"name":"زبدة فول سوداني"},{"name":"دبل شوكولاتة"},{"name":"جوز هند"},{"name":"لوز"}]'::jsonb,
   '#10B981', '🚚 التوصيل مجاني', true, 2),
  ('ice-cream', 'halawa', 'عرض الحلاوة الطحينية سبريد', '🥄 عبوة بـ 149 ج',
   'حلاوة طحينية سبريد من Healthy & Tasty — عبوة بـ 149 جنيه بدل 190 جنيه.',
   149, 190, 1, 'عبوة واحدة',
   '[]'::jsonb,
   '#F5B800', null, false, 3)
on conflict (site, slug) do nothing;

-- ─── 6) آخر خطوة (يدوي) ──────────────────────────────────────────────────────
-- 1. Authentication → Users → Add user  (إيميلك + باسورد)
-- 2. شغّل السطر ده بإيميلك:
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'YOUR_EMAIL_HERE'
--    on conflict do nothing;
--
-- 3. Authentication → Sign In / Providers → اقفل "Allow new users to sign up".
