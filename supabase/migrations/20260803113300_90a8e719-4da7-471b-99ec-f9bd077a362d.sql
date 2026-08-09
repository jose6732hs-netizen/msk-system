
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

DROP POLICY "public read active plans" ON public.plans;
CREATE POLICY "anon read active plans" ON public.plans FOR SELECT TO anon USING (active = true);
CREATE POLICY "auth read plans" ON public.plans FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(),'admin'));
