
-- Adicionar colunas que faltam nos webhooks
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'PENDING';

-- Garantir channel_number como integer
ALTER TABLE public.extension_channels 
  ALTER COLUMN channel_number TYPE integer USING (channel_number::integer);

-- Recriar função rate limit com grants corretos
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
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER) TO authenticated, service_role, anon;

-- Refresh
SELECT 1;
