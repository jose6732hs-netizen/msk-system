insert into public.msk_ai_providers (id, label, api_base_url, model) values
  ('bai', 'B.AI', 'https://api.b.ai/v1', 'deepseek-v4-flash'),
  ('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'openai/gpt-5.5'),
  ('omniroute', 'OmniRoute', 'http://127.0.0.1:20128/v1', 'z-ai/glm-5.2')
on conflict (id) do nothing;

create or replace function public.msk_ai_providers_save(p_id text, p_api_key text default null, p_model text default null, p_base_url text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_secret text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso restrito a administradores'; end if;
  if p_id not in ('openai','groq','gemini','bai','openrouter','omniroute') then raise exception 'Provedor inválido'; end if;
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
end; $function$;

create or replace function public.msk_ai_providers_set_enabled(p_id text, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso restrito a administradores'; end if;
  if p_id not in ('openai','groq','gemini','bai','openrouter','omniroute') then raise exception 'Provedor inválido'; end if;
  if p_enabled then
    update public.msk_ai_providers set enabled = false, is_primary = false, updated_at = now() where id <> p_id;
    update public.msk_ai_providers set enabled = true, is_primary = true, updated_by = auth.uid(), updated_at = now() where id = p_id;
  else
    update public.msk_ai_providers set enabled = false, is_primary = false, updated_by = auth.uid(), updated_at = now() where id = p_id;
  end if;
  return true;
end; $function$;