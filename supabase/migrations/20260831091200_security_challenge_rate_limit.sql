-- Rate limit do challenge sem depender de memória local do servidor.
-- Máximo de 20 nonces por installation_id em uma janela de 1 minuto.

create or replace function public.security_issue_nonce(
  p_installation_id text,
  p_purpose text default 'handshake',
  p_ip text default null
)
returns table(nonce uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_nonce uuid := gen_random_uuid();
  v_exp timestamptz := now() + interval '2 minutes';
  v_recent integer := 0;
begin
  if p_installation_id is null or length(trim(p_installation_id)) < 16 or length(trim(p_installation_id)) > 80 then
    raise exception 'INVALID_INSTALLATION_ID';
  end if;

  delete from public.security_nonces
  where expires_at < now() - interval '10 minutes'
     or used_at < now() - interval '10 minutes';

  select count(*)::int into v_recent
  from public.security_nonces
  where installation_id = trim(p_installation_id)
    and issued_at >= now() - interval '1 minute';

  if v_recent >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.security_nonces(id, installation_id, purpose, expires_at, ip)
  values(
    v_nonce,
    trim(p_installation_id),
    coalesce(nullif(trim(p_purpose), ''), 'handshake'),
    v_exp,
    nullif(trim(p_ip), '')
  );

  return query select v_nonce, v_exp;
end;
$$;

revoke all on function public.security_issue_nonce(text,text,text) from public;
grant execute on function public.security_issue_nonce(text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
