-- Run after schema.sql and page-content.sql. Repeatable; existing data is preserved.
begin;
create table if not exists public.change_history (
  id bigint generated always as identity primary key,
  site text not null check (site in ('cola', 'ice-cream', 'spread')),
  entity_type text not null check (entity_type in ('offers', 'page_content')),
  entity_id text not null,
  entity_label text not null,
  operation text not null check (operation in ('baseline', 'insert', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  actor_id uuid,
  actor_email text,
  created_at timestamptz not null default now()
);
create index if not exists change_history_site_time on public.change_history(site, id desc);
alter table public.change_history enable row level security;
revoke all on public.change_history from anon, authenticated;
grant select on public.change_history to authenticated;
drop policy if exists "history admin read" on public.change_history;
create policy "history admin read" on public.change_history for select to authenticated using (public.is_admin());

create or replace function public.record_landing_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare previous jsonb; following jsonb; item jsonb;
begin
  if TG_OP <> 'INSERT' then previous := to_jsonb(OLD); end if;
  if TG_OP <> 'DELETE' then following := to_jsonb(NEW); end if;
  if TG_OP = 'UPDATE' and (previous - 'updated_at') = (following - 'updated_at') then return NEW; end if;
  item := coalesce(following, previous);
  insert into public.change_history(site,entity_type,entity_id,entity_label,operation,before_data,after_data,actor_id,actor_email)
  values (item->>'site',TG_TABLE_NAME,coalesce(item->>'id',item->>'site'),coalesce(item->>'name','نصوص الصفحة'),lower(TG_OP),previous,following,auth.uid(),
    (select email from auth.users where id=auth.uid()));
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end; $$;
revoke all on function public.record_landing_change() from public, anon, authenticated;

insert into public.change_history(site,entity_type,entity_id,entity_label,operation,after_data)
select o.site,'offers',o.id::text,o.name,'baseline',to_jsonb(o) from public.offers o
where not exists(select 1 from public.change_history h where h.entity_type='offers' and h.entity_id=o.id::text);
insert into public.change_history(site,entity_type,entity_id,entity_label,operation,after_data)
select p.site,'page_content',p.site,'نصوص الصفحة','baseline',to_jsonb(p) from public.page_content p
where not exists(select 1 from public.change_history h where h.entity_type='page_content' and h.entity_id=p.site);
drop trigger if exists offers_history on public.offers;
create trigger offers_history after insert or update or delete on public.offers for each row execute function public.record_landing_change();
drop trigger if exists page_content_history on public.page_content;
create trigger page_content_history after insert or update or delete on public.page_content for each row execute function public.record_landing_change();

create table if not exists public.page_content_drafts (
  site text not null references public.page_content(site),
  user_id uuid not null references auth.users(id) on delete cascade,
  content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=20000),
  base_version timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(site,user_id)
);
alter table public.page_content_drafts enable row level security;
revoke all on public.page_content_drafts from anon, authenticated;
grant select,insert,update,delete on public.page_content_drafts to authenticated;
drop policy if exists "own admin drafts" on public.page_content_drafts;
create policy "own admin drafts" on public.page_content_drafts for all to authenticated
using(public.is_admin() and user_id=auth.uid()) with check(public.is_admin() and user_id=auth.uid());
drop trigger if exists drafts_set_updated_at on public.page_content_drafts;
create trigger drafts_set_updated_at before update on public.page_content_drafts for each row execute function public.set_updated_at();

create or replace function public.publish_page_content(p_site text,p_content jsonb,p_expected_version timestamptz,p_expected_draft_version timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_row public.page_content; saved public.page_content_drafts;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into current_row from public.page_content where site=p_site for update;
  if not found or current_row.updated_at is distinct from p_expected_version then raise exception 'Published content changed' using errcode='40001'; end if;
  select * into saved from public.page_content_drafts where site=p_site and user_id=auth.uid() for update;
  if saved.updated_at is distinct from p_expected_draft_version then raise exception 'Draft changed' using errcode='40001'; end if;
  update public.page_content set content=p_content where site=p_site returning * into current_row;
  delete from public.page_content_drafts where site=p_site and user_id=auth.uid();
  return to_jsonb(current_row);
end; $$;
revoke all on function public.publish_page_content(text,jsonb,timestamptz,timestamptz) from public,anon;
grant execute on function public.publish_page_content(text,jsonb,timestamptz,timestamptz) to authenticated;

create or replace function public.restore_landing_revision(p_revision_id bigint,p_expected_version timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare revision public.change_history; snapshot jsonb; current_version timestamptz; result jsonb; offer public.offers;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into revision from public.change_history where id=p_revision_id;
  if not found then raise exception 'Revision missing'; end if;
  snapshot := coalesce(revision.after_data,revision.before_data);
  if revision.entity_type='page_content' then
    select updated_at into current_version from public.page_content where site=revision.site for update;
    if not found or current_version is distinct from p_expected_version then raise exception 'Content changed' using errcode='40001'; end if;
    update public.page_content set content=snapshot->'content' where site=revision.site returning to_jsonb(page_content) into result;
  else
    select updated_at into current_version from public.offers where id=revision.entity_id::uuid for update;
    if current_version is distinct from p_expected_version then raise exception 'Offer changed' using errcode='40001'; end if;
    offer := jsonb_populate_record(null::public.offers,snapshot);
    if current_version is null then
      insert into public.offers(id,site,slug,name,badge,description,note,price,original_price,units,units_label,selection,flavors,image_url,accent,delivery_note,free_shipping,is_active,sort_order)
      values(offer.id,offer.site,offer.slug,offer.name,offer.badge,offer.description,offer.note,offer.price,offer.original_price,offer.units,offer.units_label,offer.selection,offer.flavors,offer.image_url,offer.accent,offer.delivery_note,offer.free_shipping,offer.is_active,offer.sort_order)
      returning to_jsonb(offers) into result;
    else
      update public.offers set name=offer.name,badge=offer.badge,description=offer.description,note=offer.note,price=offer.price,original_price=offer.original_price,
        units=offer.units,units_label=offer.units_label,selection=offer.selection,flavors=offer.flavors,image_url=offer.image_url,accent=offer.accent,delivery_note=offer.delivery_note,
        free_shipping=offer.free_shipping,is_active=offer.is_active,sort_order=offer.sort_order
      where id=offer.id returning to_jsonb(offers) into result;
    end if;
  end if;
  return result;
end; $$;
revoke all on function public.restore_landing_revision(bigint,timestamptz) from public,anon;
grant execute on function public.restore_landing_revision(bigint,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
