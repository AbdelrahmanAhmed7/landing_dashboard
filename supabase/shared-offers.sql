-- Shared offers across landing pages.
-- Run after schema.sql, history-and-drafts.sql and the shipping/selection migrations.
-- Safe to run more than once.
begin;

-- One row per page keeps each page's price, image, shipping, visibility and
-- order independent, while shared_id groups the rows that the dashboard edits
-- as a single offer.
alter table public.offers add column if not exists shared_id uuid;
update public.offers set shared_id = id where shared_id is null;
alter table public.offers alter column shared_id set default gen_random_uuid();
alter table public.offers alter column shared_id set not null;
comment on column public.offers.shared_id is 'Groups the per-page rows of one shared offer. Single-page offers use their own id.';

create unique index if not exists offers_shared_site_key on public.offers (shared_id, site);
create index if not exists offers_shared_id_idx on public.offers (shared_id);

-- Saves the whole page group in one transaction: upsert every selected page
-- and delete the pages that were removed from the group.
create or replace function public.save_shared_offer(p_rows jsonb, p_remove_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  parsed_count int;
  site_count int;
  shared uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Offer rows required' using errcode = '22023';
  end if;

  select count(*), count(distinct x.site), (array_agg(distinct x.shared_id))[1]
    into parsed_count, site_count, shared
  from jsonb_to_recordset(p_rows) as x(shared_id uuid, site text);

  if parsed_count <> jsonb_array_length(p_rows) or site_count <> parsed_count then
    raise exception 'Each page must appear once' using errcode = '22023';
  end if;
  if shared is null then
    raise exception 'Shared offer id required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as x(shared_id uuid)
    where x.shared_id is distinct from shared
  ) then
    raise exception 'All rows must share the same id' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as x(id uuid) where x.id is null) then
    raise exception 'Every row needs an id' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.offers o
    where o.id = any(p_remove_ids)
      and o.shared_id is distinct from shared
  ) then
    raise exception 'Cannot remove rows from another offer' using errcode = '22023';
  end if;

  insert into public.offers (
    id, shared_id, site, slug, name, badge, description, note, price, original_price,
    units, units_label, selection, flavors, image_url, accent, delivery_note,
    free_shipping, is_active, sort_order, shipping_mode, shipping_fee
  )
  select
    x.id, x.shared_id, x.site, x.slug, x.name, x.badge, x.description, x.note,
    x.price, x.original_price, x.units, x.units_label, x.selection, x.flavors,
    x.image_url, x.accent, x.delivery_note, x.free_shipping, x.is_active,
    x.sort_order, x.shipping_mode, x.shipping_fee
  from jsonb_to_recordset(p_rows) as x(
    id uuid, shared_id uuid, site text, slug text, name text, badge text,
    description text, note text, price numeric, original_price numeric,
    units int, units_label text, selection jsonb, flavors jsonb, image_url text,
    accent text, delivery_note text, free_shipping boolean, is_active boolean,
    sort_order int, shipping_mode text, shipping_fee numeric
  )
  on conflict (id) do update set
    shared_id = excluded.shared_id,
    site = excluded.site,
    slug = excluded.slug,
    name = excluded.name,
    badge = excluded.badge,
    description = excluded.description,
    note = excluded.note,
    price = excluded.price,
    original_price = excluded.original_price,
    units = excluded.units,
    units_label = excluded.units_label,
    selection = excluded.selection,
    flavors = excluded.flavors,
    image_url = excluded.image_url,
    accent = excluded.accent,
    delivery_note = excluded.delivery_note,
    free_shipping = excluded.free_shipping,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    shipping_mode = excluded.shipping_mode,
    shipping_fee = excluded.shipping_fee;

  if coalesce(array_length(p_remove_ids, 1), 0) > 0 then
    delete from public.offers
    where id = any(p_remove_ids)
      and id not in (select x.id from jsonb_to_recordset(p_rows) as x(id uuid));
  end if;

  return jsonb_build_object(
    'shared_id', shared,
    'saved', parsed_count,
    'removed', coalesce(array_length(p_remove_ids, 1), 0)
  );
end;
$$;

revoke all on function public.save_shared_offer(jsonb, uuid[]) from public, anon;
grant execute on function public.save_shared_offer(jsonb, uuid[]) to authenticated;

-- Keep history restores aware of shared_id and the shipping/selection columns.
create or replace function public.restore_landing_revision(p_revision_id bigint, p_expected_version timestamptz)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  revision public.change_history;
  snapshot jsonb;
  current_version timestamptz;
  result jsonb;
  offer public.offers;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select * into revision from public.change_history where id = p_revision_id;
  if not found then raise exception 'Revision missing'; end if;
  snapshot := coalesce(revision.after_data, revision.before_data);
  if revision.entity_type = 'page_content' then
    select updated_at into current_version from public.page_content where site = revision.site for update;
    if not found or current_version is distinct from p_expected_version then raise exception 'Content changed' using errcode = '40001'; end if;
    update public.page_content set content = snapshot->'content' where site = revision.site returning to_jsonb(page_content) into result;
  else
    select updated_at into current_version from public.offers where id = revision.entity_id::uuid for update;
    if current_version is distinct from p_expected_version then raise exception 'Offer changed' using errcode = '40001'; end if;
    offer := jsonb_populate_record(null::public.offers, snapshot);
    if current_version is null then
      insert into public.offers (
        id, shared_id, site, slug, name, badge, description, note, price, original_price,
        units, units_label, selection, flavors, image_url, accent, delivery_note,
        free_shipping, is_active, sort_order, shipping_mode, shipping_fee
      )
      values (
        offer.id, coalesce(offer.shared_id, offer.id), offer.site, offer.slug, offer.name,
        offer.badge, offer.description, offer.note, offer.price, offer.original_price,
        offer.units, offer.units_label, offer.selection, offer.flavors, offer.image_url,
        offer.accent, offer.delivery_note, offer.free_shipping, offer.is_active,
        offer.sort_order, offer.shipping_mode, offer.shipping_fee
      )
      returning to_jsonb(offers) into result;
    else
      update public.offers set
        shared_id = coalesce(offer.shared_id, offers.shared_id),
        name = offer.name,
        badge = offer.badge,
        description = offer.description,
        note = offer.note,
        price = offer.price,
        original_price = offer.original_price,
        units = offer.units,
        units_label = offer.units_label,
        selection = offer.selection,
        flavors = offer.flavors,
        image_url = offer.image_url,
        accent = offer.accent,
        delivery_note = offer.delivery_note,
        free_shipping = offer.free_shipping,
        shipping_fee = offer.shipping_fee,
        shipping_mode = offer.shipping_mode,
        is_active = offer.is_active,
        sort_order = offer.sort_order
      where id = offer.id
      returning to_jsonb(offers) into result;
    end if;
  end if;
  return result;
end;
$$;

revoke all on function public.restore_landing_revision(bigint, timestamptz) from public, anon;
grant execute on function public.restore_landing_revision(bigint, timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
