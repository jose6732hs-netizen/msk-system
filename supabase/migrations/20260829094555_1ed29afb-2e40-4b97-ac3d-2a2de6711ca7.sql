CREATE TABLE public.presence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_presence_sessions_last_seen ON public.presence_sessions (last_seen DESC);

GRANT SELECT, INSERT, UPDATE ON public.presence_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.presence_sessions TO authenticated;
GRANT ALL ON public.presence_sessions TO service_role;

ALTER TABLE public.presence_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence insert public" ON public.presence_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "presence update public" ON public.presence_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "presence select public" ON public.presence_sessions FOR SELECT TO anon, authenticated USING (last_seen > now() - interval '2 minutes');

CREATE OR REPLACE FUNCTION public.presence_online_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT session_id)::int
  FROM public.presence_sessions
  WHERE last_seen > now() - interval '2 minutes';
$$;

CREATE OR REPLACE FUNCTION public.presence_heartbeat(_session_id text, _user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  IF _session_id IS NULL OR length(btrim(_session_id)) < 8 THEN
    RETURN public.presence_online_count();
  END IF;

  INSERT INTO public.presence_sessions (session_id, user_id, last_seen)
  VALUES (btrim(_session_id), _user_id, now())
  ON CONFLICT (session_id)
  DO UPDATE SET last_seen = now(), user_id = COALESCE(EXCLUDED.user_id, public.presence_sessions.user_id);

  DELETE FROM public.presence_sessions WHERE last_seen < now() - interval '1 hour';

  SELECT COUNT(DISTINCT session_id)::int INTO _count
  FROM public.presence_sessions
  WHERE last_seen > now() - interval '2 minutes';

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.presence_online_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.presence_heartbeat(text, uuid) TO anon, authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.presence_sessions;