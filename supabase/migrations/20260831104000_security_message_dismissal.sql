-- MSK Security Center — exclusão visual de mensagens sem alterar o enforcement.
-- Migração aditiva/compatível. Nenhum bloqueio, licença, incidente ou log de auditoria é apagado.
-- Rollback manual, se necessário: remover os triggers/funções abaixo e depois as colunas message_hidden_* adicionadas.

alter table public.security_installations
  add column if not exists message_hidden_incident_code text,
  add column if not exists message_hidden_block_reason text,
  add column if not exists message_hidden_at timestamptz,
  add column if not exists message_hidden_by uuid references auth.users(id) on delete set null;

alter table public.security_blocks
  add column if not exists message_hidden_at timestamptz,
  add column if not exists message_hidden_by uuid references auth.users(id) on delete set null;

-- Se o motivo/código mudar, trata-se de uma nova mensagem e ela volta a aparecer automaticamente.
create or replace function public.security_reset_installation_hidden_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.incident_code is distinct from old.incident_code
     or new.block_reason is distinct from old.block_reason then
    new.message_hidden_incident_code := null;
    new.message_hidden_block_reason := null;
    new.message_hidden_at := null;
    new.message_hidden_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists security_installations_reset_hidden_message on public.security_installations;
create trigger security_installations_reset_hidden_message
before update on public.security_installations
for each row execute function public.security_reset_installation_hidden_message();

-- O mesmo vale para uma mensagem histórica cujo conteúdo seja atualizado.
create or replace function public.security_reset_block_hidden_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.reason is distinct from old.reason
     or new.block_type is distinct from old.block_type then
    new.message_hidden_at := null;
    new.message_hidden_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists security_blocks_reset_hidden_message on public.security_blocks;
create trigger security_blocks_reset_hidden_message
before update on public.security_blocks
for each row execute function public.security_reset_block_hidden_message();

create or replace function public.security_admin_dismiss_message(
  p_installation_id text,
  p_scope text default 'INCIDENT',
  p_block_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_scope text := upper(trim(coalesce(p_scope, 'INCIDENT')));
  v_install public.security_installations%rowtype;
  v_block public.security_blocks%rowtype;
begin
  if v_actor is null or not exists (
    select 1 from public.user_roles
    where user_id = v_actor and role::text = 'super_admin'
  ) then
    raise exception 'Acesso restrito ao Super Admin';
  end if;

  select * into v_install
  from public.security_installations
  where installation_id = trim(p_installation_id)
  for update;

  if not found then
    raise exception 'Instalação não encontrada';
  end if;

  if v_scope = 'INCIDENT' then
    if v_install.incident_code is null and v_install.block_reason is null then
      raise exception 'Mensagem de incidente não encontrada';
    end if;

    update public.security_installations
    set message_hidden_incident_code = incident_code,
        message_hidden_block_reason = block_reason,
        message_hidden_at = now(),
        message_hidden_by = v_actor
    where id = v_install.id;

    insert into public.security_audit_log(
      actor_type, actor_id, installation_id, action, reason, metadata
    ) values (
      'super_admin', v_actor, v_install.installation_id,
      'security.dismiss_message',
      'Mensagem de incidente removida da exibição; estado de segurança preservado.',
      jsonb_build_object(
        'scope', 'INCIDENT',
        'incident_code', v_install.incident_code,
        'block_reason', v_install.block_reason,
        'trust_status', v_install.trust_status
      )
    );

    return jsonb_build_object('ok', true, 'scope', 'INCIDENT', 'installation_id', v_install.installation_id);
  elsif v_scope = 'BLOCK' then
    if p_block_id is null then
      raise exception 'ID do bloqueio é obrigatório';
    end if;

    select * into v_block
    from public.security_blocks
    where id = p_block_id
      and installation_id = v_install.installation_id
    for update;

    if not found then
      raise exception 'Mensagem de bloqueio não encontrada';
    end if;

    update public.security_blocks
    set message_hidden_at = now(),
        message_hidden_by = v_actor
    where id = v_block.id;

    insert into public.security_audit_log(
      actor_type, actor_id, installation_id, action, reason, metadata
    ) values (
      'super_admin', v_actor, v_install.installation_id,
      'security.dismiss_message',
      'Mensagem do histórico de bloqueio removida da exibição; bloqueio preservado.',
      jsonb_build_object(
        'scope', 'BLOCK',
        'block_id', v_block.id,
        'block_type', v_block.block_type,
        'block_reason', v_block.reason,
        'released_at', v_block.released_at
      )
    );

    return jsonb_build_object(
      'ok', true,
      'scope', 'BLOCK',
      'installation_id', v_install.installation_id,
      'block_id', v_block.id
    );
  end if;

  raise exception 'Tipo de mensagem inválido';
end;
$$;

revoke all on function public.security_admin_dismiss_message(text, text, uuid) from public, anon;
grant execute on function public.security_admin_dismiss_message(text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
