alter table public.extension_installations
  add column if not exists integrity_required boolean not null default false,
  add column if not exists integrity_root text,
  add column if not exists integrity_version text,
  add column if not exists integrity_enrolled_at timestamptz,
  add column if not exists integrity_updated_at timestamptz;

comment on column public.extension_installations.integrity_required is
  'When true, critical extension APIs require an approved build integrity gate token.';
comment on column public.extension_installations.integrity_root is
  'SHA-256 canonical root of the approved extension integrity manifest.';
comment on column public.extension_installations.integrity_version is
  'Extension version bound to integrity_root.';
