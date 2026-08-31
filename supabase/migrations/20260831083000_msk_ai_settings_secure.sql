create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.msk_ai_crypto_key (
  id text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);
revoke all on table private.msk_ai_crypto_key from public, anon, authenticated;
insert into private.msk_ai_crypto_key (id, secret)
values ('default', encode(gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

create table if not exists public.msk_ai_settings (
  id text primary key default 'default',
  provider text not null default 'B.AI',
  model text not null default 'deepseek-v4-flash',
  api_base_url text not null default 'https://api.b.ai/v1/chat/completions',
  api_key_ciphertext text,
  api_key_last4 text,
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.msk_ai_settings enable row level security;
revoke all on table public.msk_ai_settings from anon, authenticated;

create or replace function public.msk_ai_settings_status()
returns table(configured boolean, provider text, model text, key_masked text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso restrito a administradores';
  end if;

  return query
  select
    coalesce(s.active and s.api_key_ciphertext is not null and s.api_key_last4 is not null, false),
    coalesce(s.provider, 'B.AI'),
    coalesce(s.model, 'deepseek-v4-flash'),
    case when s.api_key_last4 is not null then '••••' || s.api_key_last4 else null end,
    s.updated_at
  from (select 1) x
  left join public.msk_ai_settings s on s.id = 'default';
end;
$$;

create or replace function public.msk_ai_settings_save(
  p_api_key text,
  p_provider text default 'B.AI',
  p_model text default 'deepseek-v4-flash',
  p_base_url text default 'https://api.b.ai/v1/chat/completions'
)
returns table(configured boolean, provider text, model text, key_masked text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_secret text;
  v_now timestamptz := now();
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso restrito a administradores';
  end if;
  if p_api_key is null or length(trim(p_api_key)) < 16 or length(trim(p_api_key)) > 600 then
    raise exception 'API key inválida';
  end if;

  select secret into v_secret from private.msk_ai_crypto_key where id = 'default';
  if v_secret is null then
    raise exception 'Chave interna de criptografia indisponível';
  end if;

  insert into public.msk_ai_settings (
    id, provider, model, api_base_url, api_key_ciphertext, api_key_last4,
    active, updated_by, updated_at
  ) values (
    'default', coalesce(nullif(trim(p_provider), ''), 'B.AI'),
    coalesce(nullif(trim(p_model), ''), 'deepseek-v4-flash'),
    coalesce(nullif(trim(p_base_url), ''), 'https://api.b.ai/v1/chat/completions'),
    encode(pgp_sym_encrypt(trim(p_api_key), v_secret, 'cipher-algo=aes256'), 'base64'),
    right(trim(p_api_key), 4), true, auth.uid(), v_now
  )
  on conflict (id) do update set
    provider = excluded.provider,
    model = excluded.model,
    api_base_url = excluded.api_base_url,
    api_key_ciphertext = excluded.api_key_ciphertext,
    api_key_last4 = excluded.api_key_last4,
    active = true,
    updated_by = auth.uid(),
    updated_at = v_now;

  return query select true, coalesce(nullif(trim(p_provider), ''), 'B.AI'),
    coalesce(nullif(trim(p_model), ''), 'deepseek-v4-flash'),
    '••••' || right(trim(p_api_key), 4), v_now;
end;
$$;

create or replace function public.msk_ai_settings_delete()
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso restrito a administradores';
  end if;
  delete from public.msk_ai_settings where id = 'default';
  return true;
end;
$$;

create or replace function public.msk_ai_settings_decrypt()
returns table(provider text, model text, api_base_url text, api_key text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_secret text;
begin
  select secret into v_secret from private.msk_ai_crypto_key where id = 'default';
  return query
  select s.provider, s.model, s.api_base_url,
         pgp_sym_decrypt(decode(s.api_key_ciphertext, 'base64'), v_secret)
  from public.msk_ai_settings s
  where s.id = 'default' and s.active = true and s.api_key_ciphertext is not null;
end;
$$;

revoke all on function public.msk_ai_settings_status() from public, anon;
revoke all on function public.msk_ai_settings_save(text,text,text,text) from public, anon;
revoke all on function public.msk_ai_settings_delete() from public, anon;
revoke all on function public.msk_ai_settings_decrypt() from public, anon, authenticated;
grant execute on function public.msk_ai_settings_status() to authenticated;
grant execute on function public.msk_ai_settings_save(text,text,text,text) to authenticated;
grant execute on function public.msk_ai_settings_delete() to authenticated;
grant execute on function public.msk_ai_settings_decrypt() to service_role;

drop policy if exists "Admins can read extension installations" on public.extension_installations;
create policy "Admins can read extension installations"
on public.extension_installations
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read extension errors" on public.extension_errors;
create policy "Admins can read extension errors"
on public.extension_errors
for select
to authenticated
using (public.is_admin(auth.uid()));
