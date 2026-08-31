-- Contexto mínimo para o servidor verificar challenge-response sem service_role.
-- Só responde quando o hash peppered corresponde a uma licença real daquela instalação.

create or replace function public.security_device_context(
  p_token_hash text,
  p_installation_id text
)
returns table(
  resolved_user_id uuid,
  resolved_license_id uuid,
  stored_public_key_jwk jsonb,
  stored_public_key_hash text,
  stored_extension_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_license public.licenses%rowtype;
  v_security public.security_installations%rowtype;
  v_legacy public.extension_installations%rowtype;
begin
  select * into v_license from public.licenses where token_hash=p_token_hash limit 1;
  if not found then return; end if;

  select * into v_security
  from public.security_installations
  where installation_id=trim(p_installation_id)
    and (license_id=v_license.id or license_id is null)
  limit 1;

  select * into v_legacy
  from public.extension_installations
  where installation_id=trim(p_installation_id)
    and user_id=v_license.user_id
  limit 1;

  return query select
    v_license.user_id,
    v_license.id,
    coalesce(
      v_security.metadata->'device_public_key_jwk',
      v_legacy.metadata->'security_v1'->'public_key_jwk'
    ),
    coalesce(
      v_security.metadata->>'device_public_key_hash',
      v_legacy.metadata->'security_v1'->>'public_key_hash'
    ),
    coalesce(v_security.extension_id,v_legacy.first_extension_id,v_legacy.extension_id);
end;
$$;

revoke all on function public.security_device_context(text,text) from public;
grant execute on function public.security_device_context(text,text) to anon,authenticated;

notify pgrst, 'reload schema';
