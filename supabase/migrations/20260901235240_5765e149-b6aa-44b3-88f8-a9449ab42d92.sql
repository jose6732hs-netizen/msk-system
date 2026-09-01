CREATE OR REPLACE FUNCTION public.msk_ai_providers_set_primary(p_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.msk_ai_providers SET is_primary = false WHERE is_primary = true AND id <> p_id;
  UPDATE public.msk_ai_providers SET is_primary = true, enabled = true, updated_at = now() WHERE id = p_id;
  RETURN true;
END;
$$;