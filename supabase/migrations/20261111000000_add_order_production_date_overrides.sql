alter table public.orders
  add column if not exists production_date_override date;

alter table public.production_plan_orders
  add column if not exists production_date_override date;
