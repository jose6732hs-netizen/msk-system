-- Add unique constraints for security
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_document_hash_unique ON public.profiles(document_hash) WHERE (document_hash IS NOT NULL);

-- Ensure email and phone uniqueness at the profile level too
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- Function to hash and check document uniqueness
CREATE OR REPLACE FUNCTION public.check_document_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document IS NOT NULL THEN
    NEW.document_hash := encode(digest(NEW.document, 'sha256'), 'hex');
  ELSE
    NEW.document_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_document_hash_trigger
BEFORE INSERT OR UPDATE OF document ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_document_uniqueness();

-- Track who referred the user directly in the profile for easier auditing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- Grant permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
