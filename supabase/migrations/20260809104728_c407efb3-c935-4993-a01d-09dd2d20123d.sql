ALTER TABLE public.license_devices ADD COLUMN IF NOT EXISTS installation_id text;
CREATE UNIQUE INDEX IF NOT EXISTS license_devices_license_installation_idx ON public.license_devices (license_id, installation_id) WHERE installation_id IS NOT NULL;

ALTER TABLE public.trials
  ADD COLUMN IF NOT EXISTS email_hash text,
  ADD COLUMN IF NOT EXISTS phone_hash text,
  ADD COLUMN IF NOT EXISTS document_hash text,
  ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS trials_email_hash_idx ON public.trials (email_hash);
CREATE INDEX IF NOT EXISTS trials_phone_hash_idx ON public.trials (phone_hash);
CREATE INDEX IF NOT EXISTS trials_document_hash_idx ON public.trials (document_hash);
CREATE INDEX IF NOT EXISTS trials_ip_hash_idx ON public.trials (ip_hash);
CREATE INDEX IF NOT EXISTS trials_installation_idx ON public.trials (installation_id);

CREATE TABLE IF NOT EXISTS public.token_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.plans(id),
  transaction_id uuid REFERENCES public.transactions(id),
  source text NOT NULL DEFAULT 'purchase',
  total integer NOT NULL DEFAULT 1,
  used integer NOT NULL DEFAULT 0,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.token_allowances TO authenticated;
GRANT ALL ON public.token_allowances TO service_role;
ALTER TABLE public.token_allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own token allowances" ON public.token_allowances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS token_allowances_user_idx ON public.token_allowances (user_id);