-- Run once in Supabase SQL Editor after schema.sql. Safe to run again.
-- Stores published text only; the editor keeps unpublished changes in memory.
begin;
create table if not exists public.page_content (
  site text primary key check (site in ('cola', 'ice-cream', 'spread')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 20000),
  updated_at timestamptz not null default now()
);
alter table public.page_content enable row level security;
revoke all on public.page_content from anon, authenticated;
grant select on public.page_content to anon, authenticated;
grant insert, update on public.page_content to authenticated;

drop policy if exists "page content public read" on public.page_content;
create policy "page content public read" on public.page_content
  for select to anon, authenticated using (true);
drop policy if exists "page content admin insert" on public.page_content;
create policy "page content admin insert" on public.page_content
  for insert to authenticated with check (public.is_admin());
drop policy if exists "page content admin update" on public.page_content;
create policy "page content admin update" on public.page_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists page_content_set_updated_at on public.page_content;
create trigger page_content_set_updated_at before update on public.page_content
  for each row execute function public.set_updated_at();

insert into public.page_content (site) values ('cola'), ('ice-cream'), ('spread')
  on conflict (site) do nothing;
notify pgrst, 'reload schema';
commit;
