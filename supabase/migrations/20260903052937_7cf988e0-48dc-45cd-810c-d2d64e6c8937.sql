CREATE OR REPLACE FUNCTION public.msk_ai_providers_set_enabled(p_id text, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
  IF p_id NOT IN ('openai','groq','gemini') THEN RAISE EXCEPTION 'Provedor inválido'; END IF;

  IF p_enabled THEN
    IF NOT EXISTS (SELECT 1 FROM public.msk_ai_providers WHERE id = p_id AND api_key_ciphertext IS NOT NULL) THEN
      RAISE EXCEPTION 'Cadastre a API key deste provedor antes de ativá-lo';
    END IF;
    UPDATE public.msk_ai_providers SET enabled = false, is_primary = false, updated_at = now() WHERE id <> p_id;
    UPDATE public.msk_ai_providers SET enabled = true, is_primary = true, updated_by = auth.uid(), updated_at = now() WHERE id = p_id;
  ELSE
    UPDATE public.msk_ai_providers SET enabled = false, is_primary = false, updated_by = auth.uid(), updated_at = now() WHERE id = p_id;
  END IF;
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.msk_ai_providers_set_enabled(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.msk_ai_providers_set_primary(p_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
  UPDATE public.msk_ai_providers SET enabled = false, is_primary = false, updated_at = now() WHERE id <> p_id;
  UPDATE public.msk_ai_providers SET enabled = true, is_primary = true, updated_by = auth.uid(), updated_at = now() WHERE id = p_id;
  RETURN true;
END; $$;