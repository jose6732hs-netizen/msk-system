CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.msk_agent_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.msk_tasks(id) ON DELETE CASCADE,
  user_id uuid,
  lovable_project_id uuid,
  from_status text,
  to_status text NOT NULL,
  stage text,
  retry_count integer NOT NULL DEFAULT 0,
  error_code text,
  branch_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msk_agent_checkpoints_task_time ON public.msk_agent_checkpoints(task_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_msk_agent_checkpoints_status_time ON public.msk_agent_checkpoints(to_status, occurred_at DESC);
ALTER TABLE public.msk_agent_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_agent_checkpoints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.msk_agent_checkpoints FROM anon, authenticated;
GRANT ALL ON public.msk_agent_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION public.msk_capture_task_checkpoint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.retry_count IS DISTINCT FROM OLD.retry_count
     OR NEW.error_code IS DISTINCT FROM OLD.error_code
     OR NEW.branch_name IS DISTINCT FROM OLD.branch_name THEN
    INSERT INTO public.msk_agent_checkpoints(
      task_id,user_id,lovable_project_id,from_status,to_status,stage,retry_count,error_code,branch_name,metadata,occurred_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.lovable_project_id,
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      COALESCE(NEW.error_stage, NEW.status),
      COALESCE(NEW.retry_count,0),
      NEW.error_code,
      NEW.branch_name,
      jsonb_build_object(
        'has_summary', NEW.summary IS NOT NULL AND btrim(NEW.summary) <> '',
        'has_pull_request', NEW.pull_request_url IS NOT NULL AND btrim(NEW.pull_request_url) <> ''
      ),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_msk_capture_task_checkpoint ON public.msk_tasks;
CREATE TRIGGER trg_msk_capture_task_checkpoint
AFTER INSERT OR UPDATE OF status,retry_count,error_code,error_stage,branch_name,summary,pull_request_url
ON public.msk_tasks
FOR EACH ROW EXECUTE FUNCTION public.msk_capture_task_checkpoint();

CREATE TABLE IF NOT EXISTS public.msk_task_proofs (
  task_id uuid PRIMARY KEY REFERENCES public.msk_tasks(id) ON DELETE CASCADE,
  user_id uuid,
  lovable_project_id uuid,
  repository text NOT NULL,
  branch_name text NOT NULL,
  commit_sha text NOT NULL,
  commit_url text,
  files_changed_count integer NOT NULL CHECK (files_changed_count >= 0),
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  commit_verified boolean NOT NULL DEFAULT false,
  branch_contains_commit boolean NOT NULL DEFAULT false,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msk_task_proofs_project_time ON public.msk_task_proofs(lovable_project_id, verified_at DESC);
ALTER TABLE public.msk_task_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_task_proofs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.msk_task_proofs FROM anon, authenticated;
GRANT ALL ON public.msk_task_proofs TO service_role;

CREATE TABLE IF NOT EXISTS public.msk_agent_skill_catalog (
  skill_key text PRIMARY KEY,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  detector_regex text NOT NULL,
  dependency_hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal','sensitive')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.msk_agent_skill_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msk_agent_skill_catalog FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.msk_agent_skill_catalog FROM anon, authenticated;
GRANT ALL ON public.msk_agent_skill_catalog TO service_role;
INSERT INTO public.msk_agent_skill_catalog(skill_key,label,detector_regex,dependency_hints,validation_rules,risk_level)
VALUES
 ('ui','UI/Visual','(cor|layout|fundo|background|css|estilo|efeito|animacao|scroll|responsiv)','[]','{"max_fast_files":2,"require_semantic_review":true}','normal'),
 ('ecommerce','E-commerce','(checkout|carrinho|produto|oferta|desconto|loja)','[]','{"require_semantic_review":true,"prefer_complex_edit":true}','normal'),
 ('payments','Pagamentos','(pagamento|pix|cartao|gateway|cobranca|payment)','[]','{"require_credential_vault":true,"prefer_complex_edit":true}','normal'),
 ('auth','Autenticação','(auth|login|senha|sessao|oauth|permissao)','[]','{"require_semantic_review":true,"prefer_pr":true}','sensitive'),
 ('database','Banco de dados','(supabase|banco|database|migration|rls|sql)','[]','{"require_semantic_review":true,"prefer_pr":true}','sensitive'),
 ('api_integration','API/Integração','(api|endpoint|webhook|bearer|oauth|integracao)','[]','{"require_documentation_parse":true,"require_semantic_review":true}','normal')
ON CONFLICT (skill_key) DO UPDATE SET
  label=EXCLUDED.label,
  detector_regex=EXCLUDED.detector_regex,
  dependency_hints=EXCLUDED.dependency_hints,
  validation_rules=EXCLUDED.validation_rules,
  risk_level=EXCLUDED.risk_level,
  updated_at=now();

ALTER TABLE public.msk_tasks DROP CONSTRAINT IF EXISTS msk_tasks_status_check;
ALTER TABLE public.msk_tasks ADD CONSTRAINT msk_tasks_status_check CHECK (status = ANY (ARRAY[
  'queued','understanding','locating_files','analyzing','editing','refining','self_correcting','no_changes_retry','validating','finalizing','committing','verifying','verification_pending','awaiting_input','awaiting_credentials','saving_credentials','awaiting_approval','completed','completed_no_change','failed','cancelled'
]::text[]));

CREATE OR REPLACE FUNCTION public.msk_agent_health_snapshot()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH t AS (
  SELECT
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS total_24h,
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status IN ('completed','completed_no_change')) AS success_24h,
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status='failed') AS failed_24h,
    count(*) FILTER (WHERE created_at >= now() - interval '1 hour' AND status NOT IN ('completed','completed_no_change','failed','cancelled','awaiting_input','awaiting_credentials','awaiting_approval')) AS active_1h
  FROM public.msk_tasks
), e AS (
  SELECT
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND code='INTERNAL_ERROR') AS internal_24h,
    count(*) FILTER (WHERE created_at >= now() - interval '1 hour' AND code='INTERNAL_ERROR') AS internal_1h
  FROM public.msk_agent_errors
)
SELECT jsonb_build_object(
  'total_24h', t.total_24h,
  'success_24h', t.success_24h,
  'failed_24h', t.failed_24h,
  'error_rate_24h', CASE WHEN t.total_24h=0 THEN 0 ELSE round((t.failed_24h::numeric/t.total_24h::numeric)*100,2) END,
  'active_1h', t.active_1h,
  'internal_error_24h', e.internal_24h,
  'internal_error_1h', e.internal_1h,
  'alert', (CASE WHEN t.total_24h >= 10 AND (t.failed_24h::numeric/t.total_24h::numeric) > 0.05 THEN true ELSE false END) OR e.internal_1h >= 2,
  'generated_at', now()
) FROM t CROSS JOIN e;
$$;
REVOKE ALL ON FUNCTION public.msk_agent_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.msk_agent_health_snapshot() TO service_role;
