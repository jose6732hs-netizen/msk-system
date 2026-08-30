-- MSK LIVE: canal profissional de entrega e metadados exclusivos da extensão.

INSERT INTO public.extension_channels (
  slug,
  display_name,
  channel_number,
  channel_type,
  active,
  enabled,
  api_base_url,
  message,
  metadata
)
VALUES (
  'msk-live',
  'MSK LIVE',
  40,
  'product',
  true,
  true,
  'https://msksystem.online',
  'Canal oficial da extensão MSK LIVE.',
  '{
    "product_slug":"msk-live",
    "license_role":"live",
    "token_namespace":"MSKLIVE",
    "license_endpoint":"/api/public/live/license/validate",
    "heartbeat_endpoint":"/api/public/live/license/heartbeat",
    "download_requires_license":true
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  channel_type = EXCLUDED.channel_type,
  active = EXCLUDED.active,
  enabled = EXCLUDED.enabled,
  api_base_url = EXCLUDED.api_base_url,
  metadata = COALESCE(public.extension_channels.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

UPDATE public.plans
SET features =
  COALESCE(features, '{}'::jsonb)
  || '{"product_type":"live","live":true}'::jsonb
  || CASE
       WHEN COALESCE(features, '{}'::jsonb) ? 'delivery' THEN '{}'::jsonb
       ELSE '{"delivery":{"method":"panel_email","link":"","instructions":"Sua licença e o acesso à MSK LIVE ficam disponíveis no painel e por e-mail após a aprovação."}}'::jsonb
     END
WHERE slug = 'msk-live'
   OR slug LIKE 'msk-live-%';
