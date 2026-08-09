GRANT SELECT ON public.extension_channels TO authenticated;
CREATE POLICY "extension_channels_admin_read"
ON public.extension_channels
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));