-- Add missing metadata column to licenses table
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Ensure it's reachable via RLS and permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

-- Force schema cache refresh by adding a comment (common trick for PostgREST)
COMMENT ON COLUMN public.licenses.metadata IS 'Metadata for license tracking and plan snapshots';
