create table if not exists public.production_plan_orders (
  production_plan_id text not null references public.production_plans(id) on delete cascade,
  order_id text not null references public.orders(id) on delete cascade,
  planned_units numeric not null check (planned_units >= 0),
  primary key (production_plan_id, order_id)
);

create index if not exists production_plan_orders_order_id_idx
  on public.production_plan_orders(order_id);

insert into public.production_plan_orders (production_plan_id, order_id, planned_units)
select
  pp.id,
  pp.order_id,
  coalesce(pp.planned_units, pp.planned_cs * coalesce(p.unit_per_cs, 24))
from public.production_plans pp
left join public.products p on p.id = pp.product_id
where pp.order_id is not null
on conflict (production_plan_id, order_id) do nothing;
