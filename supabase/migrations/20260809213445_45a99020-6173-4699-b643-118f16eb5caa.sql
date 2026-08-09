-- Primeiro, desativa qualquer build anterior do canal principal
UPDATE public.extension_builds SET is_published = false WHERE channel_slug = 'm3k-principal';

-- Insere o novo build
INSERT INTO public.extension_builds (
  version, 
  file_name, 
  storage_path, 
  size_bytes, 
  status, 
  is_official, 
  is_published, 
  channel_slug, 
  release_notes
) VALUES (
  '32.8.0', 
  'msk_sistem_licenciada.zip', 
  'official/32.8.0/msk_sistem_licenciada.zip', 
  573852, 
  'ready', 
  true, 
  true, 
  'm3k-principal', 
  'MSK SISTEM Official - Fixed Object Not Found'
);

-- Garante que o canal está ativo e apontando para a nova versão
UPDATE public.extension_channels 
SET active = true, 
    enabled = true, 
    version = '32.8.0' 
WHERE slug = 'm3k-principal';