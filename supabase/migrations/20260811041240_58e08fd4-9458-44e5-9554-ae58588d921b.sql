-- Fix security path for triggers
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.check_document_uniqueness() SET search_path = public;

-- Revoke execute from public/authenticated if not needed (they are called by triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_document_uniqueness() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_document_uniqueness() FROM authenticated;

-- Ensure has_role remains accessible but secure
ALTER FUNCTION public.has_role(UUID, public.app_role) SET search_path = public;
