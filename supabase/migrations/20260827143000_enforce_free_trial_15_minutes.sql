create or replace function public.enforce_trial_license_15m()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.type = 'trial' then
    new.starts_at := coalesce(new.starts_at, now());
    new.expires_at := new.starts_at + interval '15 minutes';
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('trial_duration_minutes', 15);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_trial_license_15m on public.licenses;
create trigger trg_enforce_trial_license_15m
before insert on public.licenses
for each row
execute function public.enforce_trial_license_15m();

create or replace function public.enforce_trial_record_15m()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.started_at := coalesce(new.started_at, now());
  new.expires_at := new.started_at + interval '15 minutes';
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('trial_duration_minutes', 15);
  return new;
end;
$$;

drop trigger if exists trg_enforce_trial_record_15m on public.trials;
create trigger trg_enforce_trial_record_15m
before insert on public.trials
for each row
execute function public.enforce_trial_record_15m();
