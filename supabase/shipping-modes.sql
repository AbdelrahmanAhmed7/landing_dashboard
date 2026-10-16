-- Run after offer-shipping.sql. Null keeps existing shipping behavior.
begin;
alter table public.offers add column if not exists shipping_mode text
  check (shipping_mode is null or shipping_mode in ('free','fixed','call_center'));
comment on column public.offers.shipping_mode is 'Explicit shipping choice. Null retains legacy interpretation.';
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
      insert into public.offers(id,site,slug,name,badge,description,note,price,original_price,units,units_label,flavors,image_url,accent,delivery_note,free_shipping,is_active,sort_order,shipping_fee,shipping_mode)
      values(offer.id,offer.site,offer.slug,offer.name,offer.badge,offer.description,offer.note,offer.price,offer.original_price,offer.units,offer.units_label,offer.flavors,offer.image_url,offer.accent,offer.delivery_note,offer.free_shipping,offer.is_active,offer.sort_order,offer.shipping_fee,offer.shipping_mode)
      returning to_jsonb(offers) into result;
    else
      update public.offers set name=offer.name,badge=offer.badge,description=offer.description,note=offer.note,price=offer.price,original_price=offer.original_price,
        units=offer.units,units_label=offer.units_label,flavors=offer.flavors,image_url=offer.image_url,accent=offer.accent,delivery_note=offer.delivery_note,
        free_shipping=offer.free_shipping,shipping_fee=offer.shipping_fee,shipping_mode=offer.shipping_mode,is_active=offer.is_active,sort_order=offer.sort_order
      where id=offer.id returning to_jsonb(offers) into result;
    end if;
  end if;
  return result;
end; $$;
revoke all on function public.restore_landing_revision(bigint,timestamptz) from public,anon;
grant execute on function public.restore_landing_revision(bigint,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
