CREATE TABLE public.extension_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  display_name text NOT NULL,
  channel_number integer NOT NULL UNIQUE CHECK (channel_number > 0),
  channel_type text NOT NULL CHECK (channel_type IN ('primary', 'reserve')),
  chrome_extension_id text CHECK (chrome_extension_id IS NULL OR chrome_extension_id ~ '^[a-p]{32}$'),
  enabled boolean NOT NULL DEFAULT false,
  version text NOT NULL DEFAULT '1.0.0',
  message text NOT NULL DEFAULT 'Extensão desativada pelo administrador.',
  api_base_url text NOT NULL DEFAULT 'https://msk-keymaster.lovable.app/api/public',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.extension_channels TO service_role;
ALTER TABLE public.extension_channels ENABLE ROW LEVEL SECURITY;

CREATE INDEX extension_channels_type_number_idx ON public.extension_channels(channel_type, channel_number);

INSERT INTO public.extension_channels
  (slug, display_name, channel_number, channel_type, chrome_extension_id, enabled, version, message)
VALUES
  ('m3k-principal', 'M3K Principal', 1, 'primary', NULL, true, '1.0.0', 'Extensão principal desativada pelo administrador.'),
  ('lvbup-reserva-01', 'LVB.Up Reserva 01', 2, 'reserve', NULL, false, '4.0.2', 'Extensão reserva 01 desativada pelo administrador.'),
  ('infinity-reserva-02', 'Infinity Credits Reserva 02', 3, 'reserve', 'hhjainkbpllpglinfpnfafpefoljfmao', false, '3.0.0', 'Extensão reserva 02 desativada pelo administrador.');