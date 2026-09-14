CREATE TABLE public.credit_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  email_hash text NOT NULL,
  quantity integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'active',
  available_again_at timestamptz NOT NULL,
  allowance_id uuid REFERENCES public.token_allowances(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_trials TO authenticated;
GRANT ALL ON public.credit_trials TO service_role;
ALTER TABLE public.credit_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credit trials" ON public.credit_trials FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage credit trials" ON public.credit_trials FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX credit_trials_user_created_idx ON public.credit_trials (user_id, created_at DESC);
CREATE INDEX credit_trials_email_created_idx ON public.credit_trials (email_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.claim_credit_trial(p_user_id uuid, p_name text, p_email text, p_email_hash text)
RETURNS TABLE(trial_id uuid, allowance_id uuid, available_again_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_allowance_id uuid;
  v_trial_id uuid;
  v_available_again_at timestamptz;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF trim(coalesce(p_name, '')) = '' OR trim(coalesce(p_email, '')) = '' OR trim(coalesce(p_email_hash, '')) = '' THEN
    RAISE EXCEPTION 'PROFILE_INCOMPLETE';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(trim(p_email_hash)), 0));

  SELECT ct.available_again_at INTO v_available_again_at
  FROM public.credit_trials ct
  WHERE (ct.user_id = p_user_id OR ct.email_hash = p_email_hash)
    AND ct.available_again_at > v_now
    AND ct.status = 'active'
  ORDER BY ct.available_again_at DESC
  LIMIT 1;

  IF v_available_again_at IS NOT NULL THEN
    RAISE EXCEPTION 'TRIAL_COOLDOWN:%', v_available_again_at;
  END IF;

  INSERT INTO public.token_allowances (user_id, source, total, used, period_end)
  VALUES (p_user_id, 'trial_credits', 4, 0, v_now + interval '24 hours')
  RETURNING id INTO v_allowance_id;

  v_available_again_at := v_now + interval '24 hours';
  INSERT INTO public.credit_trials (user_id, name, email, email_hash, quantity, status, available_again_at, allowance_id)
  VALUES (p_user_id, trim(p_name), lower(trim(p_email)), p_email_hash, 4, 'active', v_available_again_at, v_allowance_id)
  RETURNING id INTO v_trial_id;

  RETURN QUERY SELECT v_trial_id, v_allowance_id, v_available_again_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_credit_trial(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_credit_trial(uuid, text, text, text) TO service_role;

CREATE TRIGGER credit_trials_touch_updated_at BEFORE UPDATE ON public.credit_trials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();