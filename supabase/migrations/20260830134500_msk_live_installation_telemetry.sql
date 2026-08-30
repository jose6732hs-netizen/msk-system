-- Persiste na instalação MSK LIVE a versão observada durante validate/heartbeat.
-- A API já grava extension_version nos eventos de licença; este trigger mantém
-- license_devices sincronizada para o painel profissional de instalações.

CREATE OR REPLACE FUNCTION public.sync_msk_live_device_telemetry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  live_event BOOLEAN;
  reported_version TEXT;
BEGIN
  live_event :=
    COALESCE(NEW.metadata->>'product_slug', '') = 'msk-live'
    OR COALESCE(NEW.metadata->>'product', '') = 'msk-live';

  IF NOT live_event OR NEW.license_id IS NULL OR NEW.device_hash IS NULL THEN
    RETURN NEW;
  END IF;

  reported_version := NULLIF(BTRIM(COALESCE(NEW.metadata->>'extension_version', '')), '');

  UPDATE public.license_devices
  SET
    extension_version = COALESCE(reported_version, extension_version),
    last_validation = COALESCE(NEW.created_at, now()),
    last_seen = GREATEST(
      COALESCE(last_seen, COALESCE(NEW.created_at, now())),
      COALESCE(NEW.created_at, now())
    )
  WHERE license_id = NEW.license_id
    AND device_hash = NEW.device_hash;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS license_events_sync_msk_live_device_telemetry ON public.license_events;
CREATE TRIGGER license_events_sync_msk_live_device_telemetry
AFTER INSERT ON public.license_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_msk_live_device_telemetry();
