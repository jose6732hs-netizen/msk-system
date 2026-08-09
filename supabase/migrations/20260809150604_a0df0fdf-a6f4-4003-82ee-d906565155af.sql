-- RPC to increment clicks safely
CREATE OR REPLACE FUNCTION public.increment_affiliate_clicks(aff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.affiliates
    SET total_clicks = total_clicks + 1
    WHERE id = aff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_affiliate_clicks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_affiliate_clicks(uuid) TO service_role;
