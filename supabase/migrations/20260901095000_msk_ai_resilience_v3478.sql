CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.msk_tasks DROP CONSTRAINT IF EXISTS msk_tasks_status_check;
ALTER TABLE public.msk_tasks ADD CONSTRAINT msk_tasks_status_check CHECK (status = ANY (ARRAY[
  'queued','queued_waiting_ai','understanding','locating_files','analyzing','editing','refining','self_correcting','no_changes_retry','validating','finalizing','committing','verifying','verification_pending','awaiting_input','awaiting_credentials','saving_credentials','awaiting_approval','completed','completed_no_change','failed','cancelled'
]::text[]));

CREATE TABLE IF NOT EXISTS public.msk_ai_provider_health (
  provider_id text PRIMARY KEY REFERENCES public.msk_ai_settings(id) ON DELETE CASCADE,
  circuit_state text NOT NULL DEFAULT 'closed' CHECK (circuit_state IN ('closed','open','half_open')),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  opened_until timestamptz,
  last_status_code integer,
  last_latency_ms integer,
  last_error_code text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.msk_ai_retry_queue (
  task_id uuid PRIMARY KEY REFERENCES public.msk_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lovable_project_id uuid NOT NULL,
  reason_code text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.msk_ai_provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_ai_provider_health FORCE ROW LEVEL SECURITY;
ALTER TABLE public.msk_ai_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_ai_retry_queue FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.msk_ai_provider_health FROM anon, authenticated;
REVOKE ALL ON public.msk_ai_retry_queue FROM anon, authenticated;
GRANT ALL ON public.msk_ai_provider_health TO service_role;
GRANT ALL ON public.msk_ai_retry_queue TO service_role;

CREATE INDEX IF NOT EXISTS msk_ai_retry_queue_due_idx ON public.msk_ai_retry_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS msk_ai_retry_queue_project_idx ON public.msk_ai_retry_queue(lovable_project_id, updated_at DESC);
