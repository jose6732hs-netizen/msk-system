-- 1. Pin search_path on remaining functions
ALTER FUNCTION public.promote_first_user_to_super_admin() SET search_path = public;
ALTER FUNCTION public.handle_new_device_activation() SET search_path = public;

-- 2. Revoke public execution on internal/trigger functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_device_activation() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.promote_first_user_to_super_admin() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.increment_affiliate_clicks(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, public;

-- 3. Admin-only policies for tables that have RLS enabled but no policy
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_events','resellers','offers','transactions','withdrawals','products','payment_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admins manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "admins manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%1$I TO service_role', t);
  END LOOP;
END $$;

-- 4. Remove temporary setup privileges
REVOKE anon, authenticated, service_role FROM sandbox_exec;
REVOKE ALL ON auth.users FROM sandbox_exec;
REVOKE ALL ON storage.objects FROM sandbox_exec;
REVOKE ALL ON storage.buckets FROM sandbox_exec;
REVOKE ALL ON SCHEMA auth FROM sandbox_exec;