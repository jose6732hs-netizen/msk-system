DROP POLICY IF EXISTS "cms media admin write" ON storage.objects;
CREATE POLICY "cms media admin write" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'cms-media' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
WITH CHECK (bucket_id = 'cms-media' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

DROP POLICY IF EXISTS "cms media read" ON storage.objects;
CREATE POLICY "cms media read" ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'cms-media');