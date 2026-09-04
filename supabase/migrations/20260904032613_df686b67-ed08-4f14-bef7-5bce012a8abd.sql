CREATE TABLE IF NOT EXISTS public.msk_agent_skill_catalog (
  id text PRIMARY KEY,
  label text NOT NULL,
  instructions text,
  validation text,
  risk text NOT NULL DEFAULT 'medium',
  max_files integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.msk_agent_skill_catalog TO authenticated;
GRANT ALL ON public.msk_agent_skill_catalog TO service_role;

ALTER TABLE public.msk_agent_skill_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill catalog readable by authenticated" ON public.msk_agent_skill_catalog;
CREATE POLICY "skill catalog readable by authenticated"
  ON public.msk_agent_skill_catalog FOR SELECT TO authenticated USING (true);

INSERT INTO public.msk_agent_skill_catalog (id, label, instructions, validation, risk, max_files) VALUES
  ('theme_edit', 'Tema / cores / estilo', 'Altere apenas tokens/classes visuais. Não mexa em lógica, dados, rotas ou estado.', 'A alteração deve tocar apenas propriedades visuais.', 'low', 3),
  ('copy_edit', 'Texto / copy', 'Troque somente o texto exibido. Preserve JSX, props e acessibilidade.', 'Somente strings visíveis podem mudar.', 'low', 3),
  ('image_edit', 'Imagem / logo / banner', 'Troque somente a referência de imagem (src/import/alt).', 'Somente atributos de imagem podem mudar.', 'low', 3),
  ('bug_fix', 'Correção de erro', 'Corrija a causa do erro com a menor alteração possível.', 'O arquivo precisa continuar compilável.', 'medium', 4),
  ('payment_edit', 'Pagamentos', 'Altere somente o provedor/fluxo de pagamento citado.', 'Nenhuma chave secreta pode ir para o cliente.', 'high', 4),
  ('api_config', 'API / integração', 'Ajuste somente a integração citada; chaves ficam em variáveis de ambiente.', 'Segredos não podem ser literais no código.', 'high', 4),
  ('github_edit', 'Repositório / arquivos', 'Altere somente os arquivos de repositório citados.', 'Nenhum código de produto pode ser alterado sem pedido explícito.', 'medium', 3),
  ('generic_edit', 'Alteração geral', 'Execute exatamente o pedido, com a menor alteração possível.', 'Preserve toda a lógica não relacionada.', 'medium', 5)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.msk_enforce_single_active_ai()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.enabled IS TRUE THEN
    UPDATE public.msk_ai_providers
       SET enabled = false, is_primary = false, updated_at = now()
     WHERE id <> NEW.id AND (enabled IS TRUE OR is_primary IS TRUE);
    NEW.is_primary := true;
  ELSE
    NEW.is_primary := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS msk_single_active_ai ON public.msk_ai_providers;
CREATE TRIGGER msk_single_active_ai
  BEFORE INSERT OR UPDATE OF enabled, is_primary ON public.msk_ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.msk_enforce_single_active_ai();