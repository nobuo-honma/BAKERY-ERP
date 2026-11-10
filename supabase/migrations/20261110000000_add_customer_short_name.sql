alter table public.customers
  add column if not exists short_name text;
