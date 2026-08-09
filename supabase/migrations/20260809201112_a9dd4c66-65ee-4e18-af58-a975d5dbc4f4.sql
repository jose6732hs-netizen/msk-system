DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Permitir upload de documentos KYC" ON storage.objects;
CREATE POLICY "Permitir upload de documentos KYC" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'affiliate-docs');

DROP POLICY IF EXISTS "Permitir leitura de documentos KYC" ON storage.objects;
CREATE POLICY "Permitir leitura de documentos KYC" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'affiliate-docs');

DROP POLICY IF EXISTS "admins manage extension builds objects" ON storage.objects;
CREATE POLICY "admins manage extension builds objects" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'extension-builds' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'extension-builds' AND public.has_role(auth.uid(),'admin'));