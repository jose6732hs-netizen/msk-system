DELETE FROM public.license_events
WHERE created_at < now() - interval '3 days'
  AND event_type IN ('heartbeat','validated','validate','license_check');