CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.msk_database_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lovable_project_id uuid NOT NULL REFERENCES public.msk_projects(lovable_project_id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('supabase','lovable_cloud')),
  name text NOT NULL DEFAULT 'Produção',
  credentials_ciphertext text NOT NULL,
  credential_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown','connected','linked','degraded','error','disconnected')),
  status_code text,
  latency_ms integer,
  last_checked_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lovable_project_id, provider, name)
);

CREATE INDEX IF NOT EXISTS idx_msk_database_connections_project
  ON public.msk_database_connections(user_id, lovable_project_id, is_default DESC, provider);

ALTER TABLE public.msk_database_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_database_connections FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.msk_database_connections FROM anon, authenticated;
GRANT ALL ON public.msk_database_connections TO service_role;

CREATE OR REPLACE FUNCTION public.msk_database_connection_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_msk_database_connection_touch ON public.msk_database_connections;
CREATE TRIGGER trg_msk_database_connection_touch
BEFORE UPDATE ON public.msk_database_connections
FOR EACH ROW EXECUTE FUNCTION public.msk_database_connection_touch();

CREATE OR REPLACE FUNCTION public.msk_database_connection_set_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.msk_database_connections
       SET is_default = false, updated_at = now()
     WHERE user_id = NEW.user_id
       AND lovable_project_id = NEW.lovable_project_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_msk_database_connection_default ON public.msk_database_connections;
CREATE TRIGGER trg_msk_database_connection_default
AFTER INSERT OR UPDATE OF is_default ON public.msk_database_connections
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.msk_database_connection_set_default();