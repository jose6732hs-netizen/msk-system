alter table public.msk_tasks
  add column if not exists preview_status text not null default 'unknown',
  add column if not exists preview_verified_at timestamptz,
  add column if not exists commit_sha text,
  add column if not exists last_known_good_sha text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.msk_tasks'::regclass
      and conname = 'msk_tasks_preview_status_check'
  ) then
    alter table public.msk_tasks
      add constraint msk_tasks_preview_status_check
      check (preview_status in ('unknown','pending','healthy','failed','restored'));
  end if;
end $$;

create or replace function public.msk_tasks_fail_closed_preview_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (new.preview_status <> 'healthy' or new.preview_verified_at is null) then
    new.status := 'verification_pending';
    if new.preview_status = 'unknown' then
      new.preview_status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_msk_tasks_fail_closed_preview_gate on public.msk_tasks;
create trigger trg_msk_tasks_fail_closed_preview_gate
before insert or update on public.msk_tasks
for each row execute function public.msk_tasks_fail_closed_preview_gate();

comment on function public.msk_tasks_fail_closed_preview_gate() is
'Fail-closed: tarefas do MSK não podem entrar em completed sem preview_status=healthy e preview_verified_at confirmado.';
