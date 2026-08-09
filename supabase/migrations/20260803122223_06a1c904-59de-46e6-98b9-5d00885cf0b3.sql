CREATE POLICY "admins manage extension builds objects" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'extension-builds' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')))
WITH CHECK (bucket_id = 'extension-builds' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

ALTER TABLE public.extension_builds
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_notes text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.downloads ADD COLUMN IF NOT EXISTS build_id uuid REFERENCES public.extension_builds(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS extension_builds_official_published_idx
  ON public.extension_builds ((1)) WHERE is_official AND is_published;