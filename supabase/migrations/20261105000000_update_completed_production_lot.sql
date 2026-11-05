create or replace function public.update_completed_production_lot(
  p_plan_id text,
  p_new_lot_code text,
  p_update_all boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan public.production_plans%rowtype;
  v_old_lot_code text;
  v_new_lot_code text;
  v_product_name text;
  v_matching_plans integer;
begin
  v_new_lot_code := nullif(btrim(p_new_lot_code), '');
  if v_new_lot_code is null then
    raise exception 'Lot番号を入力してください。';
  end if;

  select *
    into v_plan
    from public.production_plans
   where id = p_plan_id
   for update;

  if not found then
    raise exception '製造計画が見つかりません。';
  end if;
  if v_plan.status <> 'completed' then
    raise exception '完了済みの製造計画のみLot番号を変更できます。';
  end if;

  v_old_lot_code := v_plan.lot_code;
  if v_old_lot_code = v_new_lot_code then
    return;
  end if;

  select count(*)
    into v_matching_plans
    from public.production_plans
   where product_id = v_plan.product_id
     and lot_code = v_old_lot_code
     and status = 'completed';

  if v_matching_plans > 1 and not coalesce(p_update_all, false) then
    raise exception '同じ製品・Lot番号の完了済み製造計画が複数あります。関連計画を含めて更新してください。';
  end if;

  select name || ' (' || variant_name || ')'
    into v_product_name
    from public.products
   where id = v_plan.product_id;

  if exists (
    select 1 from public.production_plans
     where lot_code = v_new_lot_code and id <> p_plan_id
  ) then
    raise exception '指定したLot番号は別の製造計画で使用されています。';
  end if;
  if exists (
    select 1 from public.product_stocks
     where lot_code = v_new_lot_code and lot_code <> v_old_lot_code
  ) then
    raise exception '指定したLot番号は製品在庫で既に使用されています。';
  end if;
  if exists (
    select 1
      from public.sensory_tests old_record
      join public.sensory_tests new_record
        on new_record.test_date = old_record.test_date
       and new_record.lot_code = v_new_lot_code
       and new_record.product_name = v_product_name
     where old_record.lot_code = v_old_lot_code
       and old_record.product_name = v_product_name
  ) then
    raise exception '指定したLot番号は同日の官能検査記録で既に使用されています。';
  end if;
  if exists (
    select 1
      from public.ecopack_checks old_record
      join public.ecopack_checks new_record
        on new_record.check_date = old_record.check_date
       and new_record.lot_code = v_new_lot_code
       and new_record.product_name = v_product_name
     where old_record.lot_code = v_old_lot_code
       and old_record.product_name = v_product_name
  ) then
    raise exception '指定したLot番号は同日のエコパック検査記録で既に使用されています。';
  end if;

  update public.production_plans
     set lot_code = v_new_lot_code
   where product_id = v_plan.product_id
     and lot_code = v_old_lot_code
     and status = 'completed'
     and (coalesce(p_update_all, false) or id = p_plan_id);
  update public.product_stocks
     set lot_code = v_new_lot_code
   where lot_code = v_old_lot_code
     and product_id = v_plan.product_id;
  update public.keep_samples
     set lot_code = v_new_lot_code,
         management_no = case
           when left(management_no, length('KS-' || v_old_lot_code || '-')) = 'KS-' || v_old_lot_code || '-'
             then 'KS-' || v_new_lot_code || '-' || substring(management_no from length('KS-' || v_old_lot_code || '-') + 1)
           else management_no
         end
   where lot_code = v_old_lot_code
     and product_id = v_plan.product_id;
  update public.shipments
     set lot_code = v_new_lot_code
   where lot_code = v_old_lot_code
     and order_id in (
       select id from public.orders where product_id = v_plan.product_id
     );
  update public.sensory_tests
     set lot_code = v_new_lot_code
   where lot_code = v_old_lot_code
     and product_name = v_product_name;
  update public.ecopack_checks
     set lot_code = v_new_lot_code
   where lot_code = v_old_lot_code
     and product_name = v_product_name;
end;
$$;
