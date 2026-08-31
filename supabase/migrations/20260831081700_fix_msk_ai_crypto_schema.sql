-- Corrige o schema real do pgcrypto no Lovable Cloud/Supabase.
-- Evita erro de função pgp_sym_encrypt/pgp_sym_decrypt não encontrada.

create or replace function public.msk_ai_settings_save(
  p_api_key text,
  p_provider text default 'B.AI',
  p_model text default 'deepseek-v4-flash',
  p_base_url text default 'https://api.b.ai/v1/chat/completions'
)
returns table(configured boolean, provider text, model text, key_masked text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
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
    encode(extensions.pgp_sym_encrypt(trim(p_api_key), v_secret, 'cipher-algo=aes256'), 'base64'),
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

  return query select true,
    coalesce(nullif(trim(p_provider), ''), 'B.AI'),
    coalesce(nullif(trim(p_model), ''), 'deepseek-v4-flash'),
    '••••' || right(trim(p_api_key), 4),
    v_now;
end;
$$;

create or replace function public.msk_ai_settings_decrypt()
returns table(provider text, model text, api_base_url text, api_key text)
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_secret text;
begin
  select secret into v_secret from private.msk_ai_crypto_key where id = 'default';
  return query
  select s.provider, s.model, s.api_base_url,
         extensions.pgp_sym_decrypt(decode(s.api_key_ciphertext, 'base64'), v_secret)
  from public.msk_ai_settings s
  where s.id = 'default'
    and s.active = true
    and s.api_key_ciphertext is not null;
end;
$$;

revoke all on function public.msk_ai_settings_save(text,text,text,text) from public, anon;
grant execute on function public.msk_ai_settings_save(text,text,text,text) to authenticated;
revoke all on function public.msk_ai_settings_decrypt() from public, anon, authenticated;
grant execute on function public.msk_ai_settings_decrypt() to service_role;

notify pgrst, 'reload schema';
