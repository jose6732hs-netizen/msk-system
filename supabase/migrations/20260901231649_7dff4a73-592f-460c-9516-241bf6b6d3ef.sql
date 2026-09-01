create table if not exists public.msk_ai_providers (
  id text primary key,
  label text not null,
  api_base_url text not null,
  model text,
  api_key_ciphertext text,
  api_key_last4 text,
  enabled boolean not null default false,
  is_primary boolean not null default false,
  last_status text,
  last_checked_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.msk_ai_providers to authenticated;
grant all on public.msk_ai_providers to service_role;
alter table public.msk_ai_providers enable row level security;

drop policy if exists "admins read ai providers" on public.msk_ai_providers;
create policy "admins read ai providers" on public.msk_ai_providers
  for select to authenticated using (public.is_admin(auth.uid()));

insert into public.msk_ai_providers (id, label, api_base_url, model)
values
  ('openai', 'OpenAI', 'https://api.openai.com/v1', 'gpt-4o-mini'),
  ('groq', 'Groq', 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile'),
  ('gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'gemini-2.0-flash')
on conflict (id) do nothing;

create or replace function public.msk_ai_providers_status()
returns table(id text, label text, api_base_url text, model text, configured boolean,
              key_masked text, enabled boolean, is_primary boolean,
              last_status text, last_checked_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.label, p.api_base_url, p.model,
         p.api_key_ciphertext is not null,
         case when p.api_key_last4 is not null then '••••' || p.api_key_last4 else null end,
         p.enabled, p.is_primary, p.last_status, p.last_checked_at, p.updated_at
  from public.msk_ai_providers p
  where public.is_admin(auth.uid())
  order by p.id;
$$;

create or replace function public.msk_ai_providers_save(
  p_id text, p_api_key text default null, p_model text default null, p_base_url text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso restrito a administradores'; end if;
  if p_id not in ('openai','groq','gemini') then raise exception 'Provedor inválido'; end if;
  if p_api_key is not null and length(trim(p_api_key)) > 0 then
    if length(trim(p_api_key)) < 16 or length(trim(p_api_key)) > 600 then raise exception 'API key inválida'; end if;
    select secret into v_secret from private.msk_ai_crypto_key where id = 'default';
    if v_secret is null then raise exception 'Chave interna de criptografia indisponível'; end if;
    update public.msk_ai_providers set
      api_key_ciphertext = encode(extensions.pgp_sym_encrypt(trim(p_api_key), v_secret, 'cipher-algo=aes256'), 'base64'),
      api_key_last4 = right(trim(p_api_key), 4),
      enabled = true
    where id = p_id;
  end if;
  update public.msk_ai_providers set
    model = coalesce(nullif(trim(p_model), ''), model),
    api_base_url = coalesce(nullif(trim(p_base_url), ''), api_base_url),
    updated_by = auth.uid(), updated_at = now()
  where id = p_id;
  return true;
end; $$;

create or replace function public.msk_ai_providers_set_primary(p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso restrito a administradores'; end if;
  update public.msk_ai_providers set is_primary = (id = p_id), updated_at = now();
  return true;
end; $$;

create or replace function public.msk_ai_providers_delete(p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso restrito a administradores'; end if;
  update public.msk_ai_providers set api_key_ciphertext = null, api_key_last4 = null,
    enabled = false, is_primary = false, last_status = null, last_checked_at = null,
    updated_by = auth.uid(), updated_at = now()
  where id = p_id;
  return true;
end; $$;

create or replace function public.msk_ai_providers_decrypt(p_id text)
returns table(id text, api_base_url text, model text, api_key text)
language plpgsql stable security definer set search_path = public as $$
declare v_secret text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso restrito a administradores'; end if;
  select secret into v_secret from private.msk_ai_crypto_key where id = 'default';
  return query
    select p.id, p.api_base_url, p.model,
      case when p.api_key_ciphertext is null then null
        else extensions.pgp_sym_decrypt(decode(p.api_key_ciphertext, 'base64'), v_secret) end
    from public.msk_ai_providers p where p.id = p_id;
end; $$;

grant execute on function public.msk_ai_providers_status() to authenticated;
grant execute on function public.msk_ai_providers_save(text, text, text, text) to authenticated;
grant execute on function public.msk_ai_providers_set_primary(text) to authenticated;
grant execute on function public.msk_ai_providers_delete(text) to authenticated;
grant execute on function public.msk_ai_providers_decrypt(text) to authenticated;