CREATE TABLE public.agent_api_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  installation_id text,
  provider text NOT NULL DEFAULT 'lovable-ai',
  model text,
  action text NOT NULL DEFAULT 'chat',
  source text NOT NULL DEFAULT 'extension',
  prompt_chars integer NOT NULL DEFAULT 0,
  reply_chars integer NOT NULL DEFAULT 0,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  http_status integer,
  latency_ms integer NOT NULL DEFAULT 0,
  error_message text,
  extension_version text,
  browser text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.agent_api_usage TO service_role;
GRANT SELECT ON public.agent_api_usage TO authenticated;

ALTER TABLE public.agent_api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read agent api usage"
ON public.agent_api_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_agent_api_usage_created_at ON public.agent_api_usage (created_at DESC);
CREATE INDEX idx_agent_api_usage_user_created ON public.agent_api_usage (user_id, created_at DESC);
CREATE INDEX idx_agent_api_usage_status ON public.agent_api_usage (status);
CREATE INDEX idx_agent_api_usage_model ON public.agent_api_usage (model);

CREATE TRIGGER update_agent_api_usage_updated_at
BEFORE UPDATE ON public.agent_api_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();