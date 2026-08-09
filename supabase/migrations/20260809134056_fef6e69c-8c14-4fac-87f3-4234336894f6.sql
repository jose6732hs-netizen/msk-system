CREATE TABLE public.affiliate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_documents TO authenticated;
GRANT ALL ON public.affiliate_documents TO service_role;
ALTER TABLE public.affiliate_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own affiliate documents" 
ON public.affiliate_documents FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert their own affiliate documents" 
ON public.affiliate_documents FOR INSERT TO authenticated
WITH CHECK (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their own affiliate documents" 
ON public.affiliate_documents FOR UPDATE TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'WAITING';
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;