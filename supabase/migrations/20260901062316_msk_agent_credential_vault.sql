CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.msk_agent_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lovable_project_id uuid NOT NULL REFERENCES public.msk_projects(lovable_project_id) ON DELETE CASCADE,
  key_name text NOT NULL,
  encrypted_value text NOT NULL,
  field_type text NOT NULL DEFAULT 'secret' CHECK (field_type IN ('public','secret','url','other')),
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lovable_project_id, key_name)
);

ALTER TABLE public.msk_agent_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_agent_secrets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.msk_agent_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msk_agent_secrets TO service_role;

CREATE INDEX IF NOT EXISTS idx_msk_agent_secrets_user_project
  ON public.msk_agent_secrets(user_id, lovable_project_id, updated_at DESC);

ALTER TABLE public.msk_tasks
  ADD COLUMN IF NOT EXISTS credential_request jsonb;

ALTER TABLE public.msk_tasks DROP CONSTRAINT IF EXISTS msk_tasks_status_check;
ALTER TABLE public.msk_tasks ADD CONSTRAINT msk_tasks_status_check CHECK (
  status = ANY (ARRAY[
    'queued'::text,
    'locating_files'::text,
    'analyzing'::text,
    'editing'::text,
    'self_correcting'::text,
    'no_changes_retry'::text,
    'validating'::text,
    'committing'::text,
    'verifying'::text,
    'finalizing'::text,
    'awaiting_input'::text,
    'awaiting_credentials'::text,
    'saving_credentials'::text,
    'awaiting_approval'::text,
    'completed'::text,
    'failed'::text,
    'cancelled'::text
  ])
);