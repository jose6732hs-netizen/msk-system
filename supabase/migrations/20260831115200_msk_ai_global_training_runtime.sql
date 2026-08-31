-- Read-only runtime projection used by the MSK AI gateway.
-- The text is operational configuration, never a secret store.

create or replace function public.msk_ai_global_training_runtime()
returns table (
  id uuid,
  version bigint,
  title text,
  instruction text,
  category text,
  priority integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.version,
    t.title,
    t.instruction,
    t.category,
    t.priority,
    t.published_at
  from public.msk_ai_global_training t
  where t.status = 'active'
    and t.scope = 'all_users'
  order by t.priority asc, t.version asc
  limit 50;
$$;

revoke all on function public.msk_ai_global_training_runtime() from public;
grant execute on function public.msk_ai_global_training_runtime() to anon, authenticated, service_role;
