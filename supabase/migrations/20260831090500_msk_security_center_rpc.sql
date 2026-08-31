-- MSK Security Center — RPCs server-side para nonce, handshake, sessão e kill switch.
-- Nenhuma função retorna token de licença, segredo ou chave administrativa.

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
begin
  if p_installation_id is null or length(trim(p_installation_id)) < 16 or length(trim(p_installation_id)) > 80 then
    raise exception 'INVALID_INSTALLATION_ID';
  end if;

  delete from public.security_nonces
  where expires_at < now() - interval '10 minutes' or used_at < now() - interval '10 minutes';

  insert into public.security_nonces(id, installation_id, purpose, expires_at, ip)
  values(v_nonce, trim(p_installation_id), coalesce(nullif(trim(p_purpose),''),'handshake'), v_exp, nullif(trim(p_ip),''));

  return query select v_nonce, v_exp;
end;
$$;

create or replace function public.security_register_handshake(
  p_token_hash text,
  p_nonce uuid,
  p_installation_id text,
  p_build_id text,
  p_extension_version text,
  p_extension_id text,
  p_manifest_hash text,
  p_build_fingerprint text,
  p_integrity_ok boolean,
  p_integrity_manifest_version text default null,
  p_browser_name text default null,
  p_browser_version text default null,
  p_os_family text default null,
  p_ip text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  ok boolean,
  code text,
  resolved_user_id uuid,
  resolved_license_id uuid,
  resolved_trust_status text,
  resolved_build_id text,
  max_devices integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_license public.licenses%rowtype;
  v_build public.security_builds%rowtype;
  v_existing public.security_installations%rowtype;
  v_nonce public.security_nonces%rowtype;
  v_other_devices integer := 0;
  v_trust text := 'ACTIVE';
  v_reason text;
  v_code text;
  v_now timestamptz := now();
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return query select false,'LICENSE_INVALID',null::uuid,null::uuid,null::text,null::text,0;
    return;
  end if;

  select * into v_nonce
  from public.security_nonces
  where id=p_nonce and installation_id=trim(p_installation_id)
    and purpose='handshake' and used_at is null and expires_at>v_now
  for update;
  if not found then
    return query select false,'MSK_NONCE_INVALID_OR_REPLAYED',null::uuid,null::uuid,null::text,null::text,0;
    return;
  end if;
  update public.security_nonces set used_at=v_now where id=v_nonce.id;

  select * into v_license from public.licenses l where l.token_hash=p_token_hash limit 1;
  if not found then
    return query select false,'LICENSE_INVALID',null::uuid,null::uuid,null::text,null::text,0;
    return;
  end if;

  if v_license.status::text <> 'active' or (v_license.starts_at is not null and v_license.starts_at>v_now) then
    update public.security_installations set trust_status='REVOKED',incident_code='MSK_LICENSE_REVOKED',last_validation=v_now
    where installation_id=trim(p_installation_id) and license_id=v_license.id;
    return query select false,'MSK_LICENSE_REVOKED',v_license.user_id,v_license.id,'REVOKED',null::text,coalesce(v_license.max_devices,1);
    return;
  end if;
  if v_license.expires_at is not null and v_license.expires_at<=v_now then
    update public.security_installations set trust_status='LICENSE_EXPIRED',incident_code='MSK_LICENSE_EXPIRED',last_validation=v_now
    where installation_id=trim(p_installation_id) and license_id=v_license.id;
    return query select false,'MSK_LICENSE_EXPIRED',v_license.user_id,v_license.id,'LICENSE_EXPIRED',null::text,coalesce(v_license.max_devices,1);
    return;
  end if;

  select * into v_existing from public.security_installations where installation_id=trim(p_installation_id);
  if found and v_existing.user_id is not null and v_existing.user_id<>v_license.user_id then
    update public.security_installations
    set trust_status='CLONED',integrity_status='FAILED',incident_code='MSK_INSTALLATION_CLONED',
        block_reason='Installation ID reutilizado por outra conta.',last_integrity_check=v_now
    where id=v_existing.id;
    insert into public.security_integrity_events(installation_id,user_id,license_id,event_type,severity,received_build,ip_address,metadata)
    values(v_existing.installation_id,v_existing.user_id,v_existing.license_id,'installation_ownership_mismatch','critical',p_build_id,p_ip,
      jsonb_build_object('attempt_user_id',v_license.user_id,'attempt_license_id',v_license.id));
    return query select false,'MSK_INSTALLATION_CLONED',v_license.user_id,v_license.id,'CLONED',p_build_id,coalesce(v_license.max_devices,1);
    return;
  end if;

  if found and v_existing.trust_status in ('BLOCKED','TAMPERED','CLONED','REVOKED','LICENSE_EXPIRED') then
    return query select false,
      case v_existing.trust_status
        when 'BLOCKED' then 'MSK_INSTALLATION_BLOCKED'
        when 'TAMPERED' then 'MSK_INTEGRITY_FAILED'
        when 'CLONED' then 'MSK_INSTALLATION_CLONED'
        when 'REVOKED' then 'MSK_LICENSE_REVOKED'
        else 'MSK_LICENSE_EXPIRED'
      end,
      v_license.user_id,v_license.id,v_existing.trust_status,v_existing.build_id,coalesce(v_license.max_devices,1);
    return;
  end if;

  if exists (
    select 1 from public.security_blocks b
    where b.released_at is null and (b.expires_at is null or b.expires_at>v_now)
      and (
        (b.block_type='INSTALLATION' and b.installation_id=trim(p_installation_id)) or
        (b.block_type='LICENSE' and b.license_id=v_license.id) or
        (b.block_type='USER' and b.user_id=v_license.user_id) or
        (b.block_type='BUILD' and b.build_id=p_build_id)
      )
  ) then
    return query select false,'MSK_INSTALLATION_BLOCKED',v_license.user_id,v_license.id,'BLOCKED',p_build_id,coalesce(v_license.max_devices,1);
    return;
  end if;

  select * into v_build from public.security_builds where build_id=p_build_id;
  if not found or v_build.active is not true then
    v_reason := 'Build inexistente ou bloqueado no registro oficial MSK.';
    v_code := 'MSK_UNTRUSTED_BUILD';
  elsif v_build.version<>p_extension_version then
    v_reason := 'Versão recebida não corresponde ao build oficial.';
    v_code := 'MSK_UNTRUSTED_BUILD';
  elsif v_build.manifest_hash is not null and lower(v_build.manifest_hash)<>lower(coalesce(p_manifest_hash,'')) then
    v_reason := 'Manifest hash divergente do build oficial.';
    v_code := 'MSK_INTEGRITY_FAILED';
  elsif v_build.build_fingerprint is not null and lower(v_build.build_fingerprint)<>lower(coalesce(p_build_fingerprint,'')) then
    v_reason := 'Build fingerprint divergente do pacote oficial.';
    v_code := 'MSK_INTEGRITY_FAILED';
  elsif p_integrity_ok is not true then
    v_reason := 'Relatório de integridade informou alteração em arquivo protegido.';
    v_code := 'MSK_INTEGRITY_FAILED';
  end if;

  if v_code is not null then
    insert into public.security_installations(
      installation_id,user_id,license_id,build_id,extension_id,extension_version,
      browser_name,browser_version,os_family,last_ip,trust_status,integrity_status,
      integrity_manifest_version,last_integrity_check,last_validation,session_required,
      block_reason,incident_code,metadata
    ) values(
      trim(p_installation_id),v_license.user_id,v_license.id,case when found then p_build_id else null end,
      p_extension_id,p_extension_version,p_browser_name,p_browser_version,p_os_family,p_ip,
      'TAMPERED','FAILED',p_integrity_manifest_version,v_now,v_now,true,v_reason,v_code,coalesce(p_metadata,'{}'::jsonb)
    ) on conflict (installation_id) do update set
      license_id=excluded.license_id,
      build_id=excluded.build_id,
      extension_id=excluded.extension_id,
      extension_version=excluded.extension_version,
      browser_name=excluded.browser_name,
      browser_version=excluded.browser_version,
      os_family=excluded.os_family,
      last_seen_at=v_now,last_ip=excluded.last_ip,
      trust_status='TAMPERED',integrity_status='FAILED',integrity_manifest_version=excluded.integrity_manifest_version,
      last_integrity_check=v_now,last_validation=v_now,session_required=true,
      block_reason=v_reason,incident_code=v_code,metadata=coalesce(public.security_installations.metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb);

    insert into public.security_integrity_events(installation_id,user_id,license_id,event_type,severity,expected_build,received_build,expected_hash,received_hash,ip_address,metadata)
    values(trim(p_installation_id),v_license.user_id,v_license.id,'integrity_failed','critical',v_build.build_id,p_build_id,v_build.manifest_hash,p_manifest_hash,p_ip,
      jsonb_build_object('reason',v_reason,'fingerprint',p_build_fingerprint)||coalesce(p_metadata,'{}'::jsonb));

    return query select false,v_code,v_license.user_id,v_license.id,'TAMPERED',p_build_id,coalesce(v_license.max_devices,1);
    return;
  end if;

  select count(*)::int into v_other_devices
  from public.security_installations si
  where si.license_id=v_license.id and si.installation_id<>trim(p_installation_id)
    and si.trust_status in ('PENDING','ACTIVE','SUSPICIOUS') and si.blocked_at is null;

  if v_existing.id is null and v_other_devices>=coalesce(v_license.max_devices,1) then
    insert into public.security_installations(
      installation_id,user_id,license_id,build_id,extension_id,extension_version,browser_name,browser_version,os_family,
      last_ip,trust_status,integrity_status,integrity_manifest_version,last_integrity_check,last_validation,
      authorized_devices,session_required,incident_code,block_reason,metadata
    ) values(
      trim(p_installation_id),v_license.user_id,v_license.id,p_build_id,p_extension_id,p_extension_version,p_browser_name,p_browser_version,p_os_family,
      p_ip,'SUSPICIOUS','VERIFIED',p_integrity_manifest_version,v_now,v_now,v_other_devices,true,'MSK_DEVICE_LIMIT_REACHED',
      'Quantidade de instalações incompatível com o limite da licença.',coalesce(p_metadata,'{}'::jsonb)
    ) on conflict (installation_id) do nothing;
    insert into public.security_integrity_events(installation_id,user_id,license_id,event_type,severity,expected_build,received_build,ip_address,metadata)
    values(trim(p_installation_id),v_license.user_id,v_license.id,'device_limit_exceeded','high',p_build_id,p_build_id,p_ip,
      jsonb_build_object('other_devices',v_other_devices,'max_devices',coalesce(v_license.max_devices,1)));
    return query select false,'MSK_DEVICE_LIMIT_REACHED',v_license.user_id,v_license.id,'SUSPICIOUS',p_build_id,coalesce(v_license.max_devices,1);
    return;
  end if;

  if v_existing.id is not null and v_existing.trust_status='SUSPICIOUS' then v_trust:='SUSPICIOUS'; end if;

  insert into public.security_installations(
    installation_id,user_id,license_id,build_id,extension_id,extension_version,browser_name,browser_version,os_family,
    last_ip,trust_status,integrity_status,integrity_manifest_version,last_integrity_check,last_validation,
    authorized_devices,session_required,incident_code,metadata
  ) values(
    trim(p_installation_id),v_license.user_id,v_license.id,p_build_id,p_extension_id,p_extension_version,p_browser_name,p_browser_version,p_os_family,
    p_ip,v_trust,'VERIFIED',p_integrity_manifest_version,v_now,v_now,v_other_devices+1,true,
    case when v_trust='SUSPICIOUS' then v_existing.incident_code else null end,
    coalesce(p_metadata,'{}'::jsonb)
  ) on conflict (installation_id) do update set
    user_id=excluded.user_id,license_id=excluded.license_id,build_id=excluded.build_id,
    extension_id=excluded.extension_id,extension_version=excluded.extension_version,
    browser_name=coalesce(excluded.browser_name,public.security_installations.browser_name),
    browser_version=coalesce(excluded.browser_version,public.security_installations.browser_version),
    os_family=coalesce(excluded.os_family,public.security_installations.os_family),
    last_seen_at=v_now,last_ip=coalesce(excluded.last_ip,public.security_installations.last_ip),
    trust_status=case when public.security_installations.trust_status='SUSPICIOUS' then 'SUSPICIOUS' else 'ACTIVE' end,
    integrity_status='VERIFIED',integrity_manifest_version=excluded.integrity_manifest_version,
    last_integrity_check=v_now,last_validation=v_now,authorized_devices=excluded.authorized_devices,
    session_required=true,metadata=coalesce(public.security_installations.metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb);

  if p_ip is not null and length(trim(p_ip))>0 then
    insert into public.security_installation_ips(installation_id,ip,last_seen_at)
    values(trim(p_installation_id),trim(p_ip),v_now)
    on conflict (installation_id,ip) do update set last_seen_at=v_now;
  end if;

  insert into public.security_integrity_events(installation_id,user_id,license_id,event_type,severity,expected_build,received_build,expected_hash,received_hash,ip_address,metadata)
  values(trim(p_installation_id),v_license.user_id,v_license.id,'handshake_verified','info',p_build_id,p_build_id,v_build.manifest_hash,p_manifest_hash,p_ip,
    jsonb_build_object('integrity_manifest_version',p_integrity_manifest_version));

  return query select true,'OK',v_license.user_id,v_license.id,v_trust,p_build_id,coalesce(v_license.max_devices,1);
end;
$$;

create or replace function public.security_create_session(
  p_token_hash text,
  p_installation_id text,
  p_build_id text,
  p_session_id uuid,
  p_ttl_seconds integer default 600,
  p_ip text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(created boolean, code text, expires_at timestamptz, resolved_user_id uuid, resolved_license_id uuid)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_license public.licenses%rowtype;
  v_install public.security_installations%rowtype;
  v_exp timestamptz;
begin
  select * into v_license from public.licenses where token_hash=p_token_hash limit 1;
  if not found or v_license.status::text<>'active' or (v_license.expires_at is not null and v_license.expires_at<=now()) then
    return query select false,'MSK_LICENSE_REVOKED',null::timestamptz,null::uuid,null::uuid; return;
  end if;
  select * into v_install from public.security_installations where installation_id=trim(p_installation_id) and license_id=v_license.id;
  if not found then return query select false,'MSK_SECURITY_HANDSHAKE_REQUIRED',null::timestamptz,v_license.user_id,v_license.id; return; end if;
  if v_install.trust_status in ('BLOCKED','TAMPERED','CLONED','REVOKED','LICENSE_EXPIRED') then
    return query select false,
      case when v_install.trust_status='TAMPERED' then 'MSK_INTEGRITY_FAILED' when v_install.trust_status='CLONED' then 'MSK_INSTALLATION_CLONED' else 'MSK_INSTALLATION_BLOCKED' end,
      null::timestamptz,v_license.user_id,v_license.id; return;
  end if;
  if v_install.build_id is distinct from p_build_id then return query select false,'MSK_UNTRUSTED_BUILD',null::timestamptz,v_license.user_id,v_license.id; return; end if;
  if exists(select 1 from public.security_blocks b where b.released_at is null and (b.expires_at is null or b.expires_at>now()) and
    ((b.block_type='INSTALLATION' and b.installation_id=v_install.installation_id) or (b.block_type='LICENSE' and b.license_id=v_license.id) or (b.block_type='USER' and b.user_id=v_license.user_id) or (b.block_type='BUILD' and b.build_id=p_build_id))) then
    return query select false,'MSK_INSTALLATION_BLOCKED',null::timestamptz,v_license.user_id,v_license.id; return;
  end if;
  v_exp:=now()+make_interval(secs=>greatest(60,least(coalesce(p_ttl_seconds,600),900)));
  insert into public.security_sessions(session_id,installation_id,user_id,license_id,build_id,expires_at,ip,metadata)
  values(p_session_id,v_install.installation_id,v_license.user_id,v_license.id,p_build_id,v_exp,p_ip,coalesce(p_metadata,'{}'::jsonb))
  on conflict (session_id) do nothing;
  return query select true,'OK',v_exp,v_license.user_id,v_license.id;
end;
$$;

create or replace function public.security_precheck(
  p_token_hash text,
  p_installation_id text
)
returns table(allowed boolean, code text, enrolled boolean, session_required boolean, trust_status text, build_id text, resolved_user_id uuid, resolved_license_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_license public.licenses%rowtype;
  v_install public.security_installations%rowtype;
begin
  select * into v_license from public.licenses where token_hash=p_token_hash limit 1;
  if not found then return query select false,'LICENSE_INVALID',false,false,null::text,null::text,null::uuid,null::uuid; return; end if;
  if v_license.status::text<>'active' then return query select false,'MSK_LICENSE_REVOKED',true,true,'REVOKED',null::text,v_license.user_id,v_license.id; return; end if;
  if v_license.expires_at is not null and v_license.expires_at<=now() then return query select false,'MSK_LICENSE_EXPIRED',true,true,'LICENSE_EXPIRED',null::text,v_license.user_id,v_license.id; return; end if;
  select * into v_install from public.security_installations where installation_id=trim(p_installation_id) and license_id=v_license.id;
  if not found then return query select true,'LEGACY_UNENROLLED',false,false,null::text,null::text,v_license.user_id,v_license.id; return; end if;
  if v_install.trust_status in ('BLOCKED','TAMPERED','CLONED','REVOKED','LICENSE_EXPIRED') then
    return query select false,
      case v_install.trust_status when 'TAMPERED' then 'MSK_INTEGRITY_FAILED' when 'CLONED' then 'MSK_INSTALLATION_CLONED' when 'REVOKED' then 'MSK_LICENSE_REVOKED' when 'LICENSE_EXPIRED' then 'MSK_LICENSE_EXPIRED' else 'MSK_INSTALLATION_BLOCKED' end,
      true,v_install.session_required,v_install.trust_status,v_install.build_id,v_license.user_id,v_license.id; return;
  end if;
  if exists(select 1 from public.security_blocks b where b.released_at is null and (b.expires_at is null or b.expires_at>now()) and
    ((b.block_type='INSTALLATION' and b.installation_id=v_install.installation_id) or (b.block_type='LICENSE' and b.license_id=v_license.id) or (b.block_type='USER' and b.user_id=v_license.user_id) or (b.block_type='BUILD' and b.build_id=v_install.build_id))) then
    return query select false,'MSK_INSTALLATION_BLOCKED',true,v_install.session_required,'BLOCKED',v_install.build_id,v_license.user_id,v_license.id; return;
  end if;
  return query select true,'OK',true,v_install.session_required,v_install.trust_status,v_install.build_id,v_license.user_id,v_license.id;
end;
$$;

create or replace function public.security_validate_session(
  p_token_hash text,
  p_installation_id text,
  p_session_id uuid,
  p_build_id text
)
returns table(allowed boolean, code text, trust_status text, resolved_user_id uuid, resolved_license_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pre record;
  v_session public.security_sessions%rowtype;
begin
  select * into v_pre from public.security_precheck(p_token_hash,p_installation_id);
  if v_pre.allowed is not true then return query select false,v_pre.code,v_pre.trust_status,v_pre.resolved_user_id,v_pre.resolved_license_id; return; end if;
  select * into v_session from public.security_sessions s
  where s.session_id=p_session_id and s.installation_id=trim(p_installation_id) and s.license_id=v_pre.resolved_license_id
    and s.build_id=p_build_id and s.revoked_at is null and s.expires_at>now();
  if not found then return query select false,'MSK_SECURITY_SESSION_INVALID',v_pre.trust_status,v_pre.resolved_user_id,v_pre.resolved_license_id; return; end if;
  update public.security_sessions set last_seen_at=now() where id=v_session.id;
  update public.security_installations set last_validation=now(),last_seen_at=now() where installation_id=trim(p_installation_id);
  return query select true,'OK',v_pre.trust_status,v_pre.resolved_user_id,v_pre.resolved_license_id;
end;
$$;

create or replace function public.security_admin_installation_action(
  p_installation_id text,
  p_action text,
  p_reason text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_actor_type text:='admin';
  v_install public.security_installations%rowtype;
  v_action text:=upper(trim(p_action));
  v_reason text:=coalesce(nullif(trim(p_reason),''),'Ação administrativa no MSK Security Center.');
begin
  if not public.is_admin(v_actor) then raise exception 'Acesso restrito a administradores'; end if;
  if exists(select 1 from public.user_roles where user_id=v_actor and role::text='super_admin') then v_actor_type:='super_admin'; end if;
  select * into v_install from public.security_installations where installation_id=trim(p_installation_id) for update;
  if not found then raise exception 'Instalação não encontrada'; end if;

  if v_action='BLOCK' then
    update public.security_installations set trust_status='BLOCKED',blocked_at=now(),blocked_by=v_actor,block_reason=v_reason,incident_code='MSK_INSTALLATION_BLOCKED' where id=v_install.id;
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where installation_id=v_install.installation_id and revoked_at is null;
    update public.extension_installations set blocked=true,block_reason=v_reason where installation_id=v_install.installation_id;
    insert into public.security_blocks(installation_id,user_id,license_id,build_id,block_type,reason,evidence)
      values(v_install.installation_id,v_install.user_id,v_install.license_id,v_install.build_id,'INSTALLATION',v_reason,coalesce(p_evidence,'{}'::jsonb));
  elsif v_action='UNBLOCK' then
    update public.security_blocks set released_at=now(),released_by=v_actor where installation_id=v_install.installation_id and block_type='INSTALLATION' and released_at is null;
    update public.security_installations set trust_status=case when integrity_status='FAILED' then 'SUSPICIOUS' else 'ACTIVE' end,blocked_at=null,blocked_by=null,block_reason=null,incident_code=null where id=v_install.id;
    update public.extension_installations set blocked=false,block_reason=null where installation_id=v_install.installation_id;
  elsif v_action='REVOKE_SESSIONS' then
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where installation_id=v_install.installation_id and revoked_at is null;
  elsif v_action='REVOKE_LICENSE' then
    update public.licenses set status='revoked',revoked_at=now(),revocation_reason=v_reason where id=v_install.license_id;
    update public.security_installations set trust_status='REVOKED',incident_code='MSK_LICENSE_REVOKED',block_reason=v_reason where license_id=v_install.license_id;
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where license_id=v_install.license_id and revoked_at is null;
    update public.extension_installations set blocked=true,block_reason=v_reason where license_id=v_install.license_id;
    insert into public.security_blocks(installation_id,user_id,license_id,build_id,block_type,reason,evidence)
      values(v_install.installation_id,v_install.user_id,v_install.license_id,v_install.build_id,'LICENSE',v_reason,coalesce(p_evidence,'{}'::jsonb));
  elsif v_action='FORCE_REAUTH' then
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where installation_id=v_install.installation_id and revoked_at is null;
    update public.security_installations set session_required=true,trust_status=case when trust_status='ACTIVE' then 'PENDING' else trust_status end,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('force_reauth_at',now(),'force_reauth_by',v_actor) where id=v_install.id;
  elsif v_action='REMOVE_DEVICE' then
    update public.license_devices set status='removed' where license_id=v_install.license_id and installation_id=v_install.installation_id;
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where installation_id=v_install.installation_id and revoked_at is null;
  elsif v_action='MARK_TRUSTED' then
    if exists(select 1 from public.security_blocks b where b.installation_id=v_install.installation_id and b.released_at is null) then raise exception 'Libere o bloqueio antes de marcar como confiável'; end if;
    update public.security_installations set trust_status='ACTIVE',incident_code=null,block_reason=null where id=v_install.id;
    update public.extension_installations set suspicious=false,suspicion_reason=null where installation_id=v_install.installation_id;
  elsif v_action='INVESTIGATE' then
    update public.security_installations set trust_status='SUSPICIOUS',incident_code=coalesce(incident_code,'MSK_MANUAL_INVESTIGATION'),block_reason=v_reason where id=v_install.id;
    update public.extension_installations set suspicious=true,suspicion_reason=v_reason where installation_id=v_install.installation_id;
  elsif v_action='BLOCK_USER' then
    update public.security_installations set trust_status='BLOCKED',blocked_at=now(),blocked_by=v_actor,block_reason=v_reason,incident_code='MSK_USER_BLOCKED' where user_id=v_install.user_id;
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where user_id=v_install.user_id and revoked_at is null;
    update public.extension_installations set blocked=true,block_reason=v_reason where user_id=v_install.user_id;
    insert into public.security_blocks(user_id,block_type,reason,evidence) values(v_install.user_id,'USER',v_reason,coalesce(p_evidence,'{}'::jsonb));
  else
    raise exception 'Ação de segurança inválida';
  end if;

  insert into public.security_audit_log(actor_type,actor_id,installation_id,action,reason,metadata)
  values(v_actor_type,v_actor,v_install.installation_id,'security.'||lower(v_action),v_reason,
    jsonb_build_object('license_id',v_install.license_id,'user_id',v_install.user_id,'build_id',v_install.build_id)||coalesce(p_evidence,'{}'::jsonb));

  return jsonb_build_object('ok',true,'action',v_action,'installation_id',v_install.installation_id);
end;
$$;

create or replace function public.security_admin_build_action(
  p_build_id text,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_action text:=upper(trim(p_action));
  v_reason text:=coalesce(nullif(trim(p_reason),''),'Ação administrativa no build MSK.');
begin
  if not public.is_admin(v_actor) then raise exception 'Acesso restrito a administradores'; end if;
  if not exists(select 1 from public.security_builds where build_id=p_build_id) then raise exception 'Build não encontrado'; end if;
  if v_action='BLOCK' then
    update public.security_builds set active=false,blocked_at=now(),block_reason=v_reason where build_id=p_build_id;
    update public.security_installations set trust_status='BLOCKED',blocked_at=now(),blocked_by=v_actor,block_reason=v_reason,incident_code='MSK_UNTRUSTED_BUILD' where build_id=p_build_id;
    update public.security_sessions set revoked_at=coalesce(revoked_at,now()) where build_id=p_build_id and revoked_at is null;
    update public.extension_installations ei set blocked=true,block_reason=v_reason from public.security_installations si where si.build_id=p_build_id and si.installation_id=ei.installation_id;
    insert into public.security_blocks(build_id,block_type,reason,evidence) values(p_build_id,'BUILD',v_reason,jsonb_build_object('actor_id',v_actor));
  elsif v_action='UNBLOCK' then
    update public.security_builds set active=true,blocked_at=null,block_reason=null where build_id=p_build_id;
    update public.security_blocks set released_at=now(),released_by=v_actor where build_id=p_build_id and block_type='BUILD' and released_at is null;
  else raise exception 'Ação de build inválida'; end if;
  insert into public.security_audit_log(actor_type,actor_id,action,reason,metadata)
  values('admin',v_actor,'security.build.'||lower(v_action),v_reason,jsonb_build_object('build_id',p_build_id));
  return jsonb_build_object('ok',true,'action',v_action,'build_id',p_build_id);
end;
$$;

revoke all on function public.security_issue_nonce(text,text,text) from public;
revoke all on function public.security_register_handshake(text,uuid,text,text,text,text,text,text,boolean,text,text,text,text,text,jsonb) from public;
revoke all on function public.security_create_session(text,text,text,uuid,integer,text,jsonb) from public;
revoke all on function public.security_precheck(text,text) from public;
revoke all on function public.security_validate_session(text,text,uuid,text) from public;
revoke all on function public.security_admin_installation_action(text,text,text,jsonb) from public;
revoke all on function public.security_admin_build_action(text,text,text) from public;

grant execute on function public.security_issue_nonce(text,text,text) to anon,authenticated;
grant execute on function public.security_register_handshake(text,uuid,text,text,text,text,text,text,boolean,text,text,text,text,text,jsonb) to anon,authenticated;
grant execute on function public.security_create_session(text,text,text,uuid,integer,text,jsonb) to anon,authenticated;
grant execute on function public.security_precheck(text,text) to anon,authenticated;
grant execute on function public.security_validate_session(text,text,uuid,text) to anon,authenticated;
grant execute on function public.security_admin_installation_action(text,text,text,jsonb) to authenticated;
grant execute on function public.security_admin_build_action(text,text,text) to authenticated;

notify pgrst, 'reload schema';
