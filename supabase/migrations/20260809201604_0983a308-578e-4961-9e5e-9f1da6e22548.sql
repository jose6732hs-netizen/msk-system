-- Grant read access to public tables
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT SELECT ON public.extension_branding TO anon, authenticated;

-- Ensure authenticated users can read their own profiles/licenses if needed
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.licenses TO authenticated;

-- Essential for server functions using service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;