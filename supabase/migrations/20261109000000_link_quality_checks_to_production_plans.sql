alter table public.ecopack_checks
  add column if not exists production_plan_id text
  references public.production_plans(id) on delete set null;

alter table public.sensory_tests
  add column if not exists production_plan_id text
  references public.production_plans(id) on delete set null;

create unique index if not exists ecopack_checks_production_plan_id_idx
  on public.ecopack_checks(production_plan_id)
  where production_plan_id is not null;

create unique index if not exists sensory_tests_production_plan_id_idx
  on public.sensory_tests(production_plan_id)
  where production_plan_id is not null;
