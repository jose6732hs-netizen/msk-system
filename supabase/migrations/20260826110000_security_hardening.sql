begin;

-- A tabela era temporária e pode já ter sido removida na aplicação direta do hardening.
drop table if exists public._msk_migration_payloads;

-- Configurações públicas: recriar de forma idempotente.
drop policy if exists "Public can read settings" on public.app_settings;
drop policy if exists "settings_read" on public.app_settings;
drop policy if exists "Public can read non-sensitive settings" on public.app_settings;
drop policy if exists "Authenticated can read non-sensitive settings" on public.app_settings;
create policy "Public can read non-sensitive settings"
  on public.app_settings for select to anon
  using (key <> 'vapid_keys');
create policy "Authenticated can read non-sensitive settings"
  on public.app_settings for select to authenticated
  using (key <> 'vapid_keys');

-- KYC: recriar políticas com escopo de dono/admin.
drop policy if exists "Permitir leitura de documentos KYC" on storage.objects;
drop policy if exists "Permitir upload de documentos KYC" on storage.objects;
drop policy if exists "KYC owner or admin read" on storage.objects;
drop policy if exists "KYC authenticated upload" on storage.objects;
create policy "KYC owner or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'affiliate-docs'
    and (
      public.is_admin(auth.uid())
      or exists (
        select 1
        from public.affiliate_documents d
        join public.affiliates a on a.id = d.affiliate_id
        where d.file_path = storage.objects.name
          and a.user_id = auth.uid()
      )
    )
  );

create policy "KYC authenticated upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'affiliate-docs'
    and name like 'kyc/%'
  );

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']::text[]
where id = 'affiliate-docs';

commit;
