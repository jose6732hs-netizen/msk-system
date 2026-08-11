INSERT INTO public.extension_builds (version, channel_slug, storage_path, release_notes, is_official, is_published, file_name, status)
VALUES ('40.0.0', 'main', 'licenca-completa.zip', 'Versão Licenciada Completa MSK SISTEM', true, true, 'msk_sistem_licenciada.zip', 'ready');

UPDATE public.extension_builds SET is_published = false WHERE channel_slug = 'main' AND version != '40.0.0';

GRANT SELECT ON public.extension_builds TO anon, authenticated;
GRANT ALL ON public.extension_builds TO service_role;