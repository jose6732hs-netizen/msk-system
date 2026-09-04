create or replace function public.msk_enforce_single_active_ai_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id in ('default', '__primary__') then
    return new;
  end if;

  if new.active is distinct from true then
    return new;
  end if;

  update public.msk_ai_settings
     set active = false,
         updated_at = now()
   where id not in ('default', '__primary__')
     and id <> new.id
     and active is distinct from false;

  insert into public.msk_ai_settings (id, provider, model, api_base_url, active, updated_at)
  values ('__primary__', new.id, coalesce(new.model, ''), coalesce(new.api_base_url, ''), true, now())
  on conflict (id) do update
     set provider = excluded.provider,
         model = excluded.model,
         api_base_url = excluded.api_base_url,
         active = true,
         updated_at = now();

  update public.msk_ai_settings
     set provider = coalesce(new.provider, new.id),
         model = coalesce(new.model, model),
         api_base_url = coalesce(new.api_base_url, api_base_url),
         api_key_ciphertext = new.api_key_ciphertext,
         api_key_last4 = new.api_key_last4,
         active = true,
         updated_at = now()
   where id = 'default';

  return new;
end;
$$;

drop trigger if exists msk_single_active_ai_settings on public.msk_ai_settings;
create trigger msk_single_active_ai_settings
after insert or update of active, provider, model, api_base_url, api_key_ciphertext
on public.msk_ai_settings
for each row
execute function public.msk_enforce_single_active_ai_settings();