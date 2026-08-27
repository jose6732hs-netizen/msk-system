create or replace function public.preserve_manual_test_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.type = 'test' and new.type = 'test' then
    if new.expires_at is distinct from old.expires_at then
      raise exception 'manual_test_expiry_is_immutable' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preserve_manual_test_expiry on public.licenses;
create trigger trg_preserve_manual_test_expiry
before update on public.licenses
for each row
when (old.type = 'test')
execute function public.preserve_manual_test_expiry();