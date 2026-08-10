INSERT INTO public.extension_builds (
  version, 
  channel_slug, 
  storage_path, 
  release_notes, 
  is_published,
  is_official,
  status,
  file_name
) VALUES (
  '34.0.0', 
  'm3k-principal', 
  'extension-builds/msk_sistem_licenciada_v34.zip', 
  'Adicionado hack de infinito rosa neon para Lovable e ativação condicional via declarativeContent.', 
  true,
  true,
  'stable',
  'msk_sistem_licenciada_v34.zip'
);

UPDATE public.app_settings 
SET value = '"34.0.0"' 
WHERE key = 'latest_extension_version';