
ALTER TABLE public.licenses ADD COLUMN token_encrypted TEXT;

CREATE TABLE public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bucket, identifier, window_start)
);
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(_bucket TEXT, _identifier TEXT, _limit INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INTEGER;
BEGIN
  INSERT INTO public.api_rate_limits (bucket, identifier, window_start, count)
  VALUES (_bucket, _identifier, date_trunc('minute', now()), 1)
  ON CONFLICT (bucket, identifier, window_start)
  DO UPDATE SET count = public.api_rate_limits.count + 1
  RETURNING count INTO _count;
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 hour';
  RETURN _count <= _limit;
END; $$;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
