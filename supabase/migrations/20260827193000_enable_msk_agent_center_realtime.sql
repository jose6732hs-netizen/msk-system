do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_installations') then
    alter publication supabase_realtime add table public.extension_installations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_projects') then
    alter publication supabase_realtime add table public.extension_projects;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_events') then
    alter publication supabase_realtime add table public.extension_events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_errors') then
    alter publication supabase_realtime add table public.extension_errors;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_releases') then
    alter publication supabase_realtime add table public.extension_releases;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_incidents') then
    alter publication supabase_realtime add table public.extension_incidents;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='extension_alerts') then
    alter publication supabase_realtime add table public.extension_alerts;
  end if;
end $$;
