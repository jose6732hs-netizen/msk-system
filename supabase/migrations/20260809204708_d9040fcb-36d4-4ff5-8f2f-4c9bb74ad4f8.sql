UPDATE public.extension_channels 
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{public_zip}', '"/__l5e/assets-v1/0023ca43-8006-40b9-9aa4-aa980a2529d3/oferrolgarcia-licenciada.zip"')
WHERE slug = 'm3k-principal';

UPDATE public.extension_builds
SET channel_slug = 'm3k-principal'
WHERE is_published = true;