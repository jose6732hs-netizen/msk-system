CREATE OR REPLACE FUNCTION public.check_document_uniqueness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.document IS NOT NULL AND length(btrim(NEW.document)) > 0 THEN
    NEW.document_hash := encode(sha256(convert_to(btrim(NEW.document), 'UTF8')), 'hex');
  ELSE
    NEW.document_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$;