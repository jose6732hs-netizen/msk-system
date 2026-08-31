-- Mantém o novo Security Center e o enforcement legado sincronizados sem remover compatibilidade.

create or replace function public.security_sync_to_legacy_installation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_block boolean := new.trust_status in ('TAMPERED','CLONED','REVOKED','BLOCKED','LICENSE_EXPIRED');
  v_suspicious boolean := new.trust_status in ('SUSPICIOUS','TAMPERED','CLONED');
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.user_id is null then return new; end if;

  insert into public.extension_installations(
    user_id, license_id, installation_id, version, extension_id,
    last_seen_at, last_activity_at, suspicious, suspicion_reason, blocked, block_reason
  ) values(
    new.user_id, new.license_id, new.installation_id, new.extension_version, new.extension_id,
    coalesce(new.last_seen_at,now()), now(), v_suspicious,
    case when v_suspicious then coalesce(new.block_reason,new.incident_code,'Sinal de segurança detectado.') else null end,
    v_block,
    case when v_block then coalesce(new.block_reason,new.incident_code,'Bloqueado pelo MSK Security Center.') else null end
  )
  on conflict (installation_id) do update set
    user_id=coalesce(excluded.user_id,public.extension_installations.user_id),
    license_id=coalesce(excluded.license_id,public.extension_installations.license_id),
    version=coalesce(excluded.version,public.extension_installations.version),
    extension_id=coalesce(excluded.extension_id,public.extension_installations.extension_id),
    last_seen_at=greatest(public.extension_installations.last_seen_at,excluded.last_seen_at),
    last_activity_at=now(),
    suspicious=case when v_suspicious then true else public.extension_installations.suspicious end,
    suspicion_reason=case when v_suspicious then coalesce(new.block_reason,new.incident_code,public.extension_installations.suspicion_reason) else public.extension_installations.suspicion_reason end,
    blocked=case when v_block then true else public.extension_installations.blocked end,
    block_reason=case when v_block then coalesce(new.block_reason,new.incident_code,public.extension_installations.block_reason) else public.extension_installations.block_reason end;

  return new;
end;
$$;

drop trigger if exists security_installations_bridge_to_legacy on public.security_installations;
create trigger security_installations_bridge_to_legacy
after insert or update of trust_status,integrity_status,incident_code,block_reason,last_seen_at on public.security_installations
for each row execute function public.security_sync_to_legacy_installation();

create or replace function public.security_sync_from_legacy_installation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.installation_id is null then return new; end if;

  insert into public.security_installations(
    installation_id,user_id,license_id,extension_id,extension_version,browser_name,os_family,
    last_seen_at,last_ip,trust_status,integrity_status,block_reason,incident_code,metadata
  ) values(
    new.installation_id,new.user_id,new.license_id,new.extension_id,new.version,new.browser,new.os,
    coalesce(new.last_seen_at,now()),new.ip_address,
    case when new.blocked then 'BLOCKED' when new.suspicious then 'SUSPICIOUS' else 'ACTIVE' end,
    case when new.integrity_required and new.integrity_root is not null then 'VERIFIED' when new.suspicious then 'FAILED' else 'UNKNOWN' end,
    new.block_reason,
    case when new.blocked then 'MSK_INSTALLATION_BLOCKED' when new.suspicious then 'MSK_LEGACY_SUSPICIOUS' else null end,
    jsonb_build_object('legacy_sync_at',now())
  )
  on conflict (installation_id) do update set
    user_id=coalesce(excluded.user_id,public.security_installations.user_id),
    license_id=coalesce(excluded.license_id,public.security_installations.license_id),
    extension_id=coalesce(excluded.extension_id,public.security_installations.extension_id),
    extension_version=coalesce(excluded.extension_version,public.security_installations.extension_version),
    browser_name=coalesce(excluded.browser_name,public.security_installations.browser_name),
    os_family=coalesce(excluded.os_family,public.security_installations.os_family),
    last_seen_at=greatest(public.security_installations.last_seen_at,excluded.last_seen_at),
    last_ip=coalesce(excluded.last_ip,public.security_installations.last_ip),
    trust_status=case
      when new.blocked then 'BLOCKED'
      when new.suspicious and public.security_installations.trust_status not in ('TAMPERED','CLONED','REVOKED','BLOCKED') then 'SUSPICIOUS'
      else public.security_installations.trust_status
    end,
    integrity_status=case when new.suspicious and public.security_installations.integrity_status='UNKNOWN' then 'FAILED' else public.security_installations.integrity_status end,
    block_reason=coalesce(new.block_reason,public.security_installations.block_reason),
    incident_code=case when new.blocked then 'MSK_INSTALLATION_BLOCKED' when new.suspicious then coalesce(public.security_installations.incident_code,'MSK_LEGACY_SUSPICIOUS') else public.security_installations.incident_code end,
    metadata=coalesce(public.security_installations.metadata,'{}'::jsonb)||jsonb_build_object('legacy_sync_at',now());

  return new;
end;
$$;

drop trigger if exists extension_installations_bridge_to_security on public.extension_installations;
create trigger extension_installations_bridge_to_security
after insert or update of blocked,suspicious,block_reason,suspicion_reason,last_seen_at,license_id,version,extension_id on public.extension_installations
for each row execute function public.security_sync_from_legacy_installation();

notify pgrst, 'reload schema';
