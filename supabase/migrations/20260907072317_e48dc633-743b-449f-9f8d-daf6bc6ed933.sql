DELETE FROM public.license_events
WHERE created_at < now() - interval '14 days'
  AND event_type IN ('heartbeat','validated','validate','license_check');

DELETE FROM public.license_events
WHERE created_at < now() - interval '120 days';

CREATE INDEX IF NOT EXISTS license_events_created_at_idx
  ON public.license_events (created_at DESC);
CREATE INDEX IF NOT EXISTS license_events_user_created_idx
  ON public.license_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS license_events_license_created_idx
  ON public.license_events (license_id, created_at DESC);

CREATE INDEX IF NOT EXISTS licenses_user_created_idx
  ON public.licenses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS licenses_status_idx
  ON public.licenses (status);

CREATE INDEX IF NOT EXISTS license_devices_license_seen_idx
  ON public.license_devices (license_id, last_seen DESC);
CREATE INDEX IF NOT EXISTS license_devices_last_ip_hash_idx
  ON public.license_devices (last_ip_hash);