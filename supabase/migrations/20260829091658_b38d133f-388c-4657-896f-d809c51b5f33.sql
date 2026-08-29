alter table public.extension_installations
  add column if not exists extension_id text,
  add column if not exists first_extension_id text,
  add column if not exists suspicious boolean not null default false,
  add column if not exists suspicion_reason text,
  add column if not exists blocked boolean not null default false,
  add column if not exists block_reason text;

create index if not exists extension_installations_suspicious_idx
  on public.extension_installations (suspicious) where suspicious = true;
create index if not exists extension_installations_blocked_idx
  on public.extension_installations (blocked) where blocked = true;

do $$
begin
  begin
    alter publication supabase_realtime add table public.extension_installations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.extension_replies;
  exception when duplicate_object then null;
  end;
end
$$;