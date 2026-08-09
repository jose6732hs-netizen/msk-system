UPDATE public.extension_builds SET is_published = false WHERE channel_slug = 'm3k-principal';
INSERT INTO public.extension_builds (version, file_name, storage_path, size_bytes, status, is_official, is_published, channel_slug, release_notes)
VALUES ('32.9.0', 'msk_sistem_licenciada.zip', 'official/32.9.0/msk_sistem_licenciada.zip', 575000, 'ready', true, true, 'm3k-principal', 'Popup de licença centralizado');
UPDATE public.extension_channels SET active = true, enabled = true, version = '32.9.0' WHERE slug = 'm3k-principal';