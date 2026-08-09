INSERT INTO public.extension_channels (slug, display_name, channel_number, channel_type, active, enabled, version)
VALUES ('m3k-principal', 'M3K Principal', 1, 'stable', true, true, '7.9.1')
ON CONFLICT (slug) DO UPDATE SET active = true, enabled = true;