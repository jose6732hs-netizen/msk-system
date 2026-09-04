CREATE TABLE IF NOT EXISTS public.msk_extension_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL,
  model_id text NOT NULL,
  label text NOT NULL,
  focus text NOT NULL DEFAULT 'general',
  is_free boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  note text,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, model_id)
);

GRANT SELECT ON public.msk_extension_models TO authenticated;
GRANT SELECT ON public.msk_extension_models TO anon;
GRANT ALL ON public.msk_extension_models TO service_role;

ALTER TABLE public.msk_extension_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extension models readable" ON public.msk_extension_models;
CREATE POLICY "extension models readable"
  ON public.msk_extension_models FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.msk_extension_models_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS msk_extension_models_touch ON public.msk_extension_models;
CREATE TRIGGER msk_extension_models_touch
  BEFORE UPDATE ON public.msk_extension_models
  FOR EACH ROW EXECUTE FUNCTION public.msk_extension_models_touch();

INSERT INTO public.msk_extension_models (provider_id, model_id, label, focus, is_free, visible, note, sort_order) VALUES
  ('groq', 'openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'code', true, true, 'Gratuito na Groq. Excelente para código e sites.', 10),
  ('groq', 'openai/gpt-oss-20b', 'GPT-OSS 20B (Groq)', 'code', true, true, 'Gratuito na Groq. Rápido para edições simples.', 11),
  ('groq', 'qwen/qwen3-32b', 'Qwen3 32B (Groq)', 'code', true, true, 'Gratuito. Forte em código e refatoração.', 12),
  ('groq', 'moonshotai/kimi-k2-instruct-0905', 'Kimi K2 Instruct (Groq)', 'code', true, true, 'Gratuito. Ótimo para tarefas de front-end.', 13),
  ('groq', 'deepseek-r1-distill-llama-70b', 'DeepSeek R1 Distill 70B (Groq)', 'code', true, true, 'Gratuito. Raciocínio para bugs difíceis.', 14),
  ('groq', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick (Groq)', 'code', true, true, 'Gratuito. Bom em HTML/CSS/JS.', 15),
  ('groq', 'meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout (Groq)', 'web', true, true, 'Gratuito. Contexto longo para sites.', 16),
  ('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile (Groq)', 'general', true, true, 'Gratuito. Uso geral e código.', 17),
  ('groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant (Groq)', 'general', true, true, 'Gratuito. Respostas instantâneas.', 18),
  ('groq', 'groq/compound', 'Groq Compound', 'web', true, true, 'Gratuito. Agente com busca para sites.', 19),
  ('synterolink', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'code', false, true, 'Claude via SynteroLink.', 30),
  ('openai', 'gpt-5.5', 'GPT-5.5', 'code', false, true, 'Modelo de raciocínio da OpenAI.', 40),
  ('openai', 'gpt-5.3-codex', 'GPT-5.3 Codex', 'code', false, true, 'Focado em código.', 41),
  ('gemini', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'general', false, true, 'Rápido e barato.', 50),
  ('gemini', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 'code', false, true, 'Mais forte em código.', 51),
  ('mistral', 'codestral-latest', 'Codestral', 'code', false, true, 'Especialista em código.', 60),
  ('openrouter', 'z-ai/glm-5.2', 'GLM 5.2 (OpenRouter)', 'code', false, true, 'Gateway OpenRouter.', 70),
  ('omniroute', 'z-ai/glm-5.2', 'GLM 5.2 (OmniRoute)', 'code', false, true, 'Gateway MSK.', 80),
  ('bai', 'deepseek-v4-flash', 'DeepSeek V4 Flash (B.AI)', 'general', false, true, 'IA econômica do MSK.', 90)
ON CONFLICT (provider_id, model_id) DO NOTHING;