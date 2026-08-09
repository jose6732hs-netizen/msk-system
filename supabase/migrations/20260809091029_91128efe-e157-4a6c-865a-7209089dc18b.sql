
-- 1. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_idx ON public.subscriptions (provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own subs select" ON public.subscriptions;
CREATE POLICY "own subs select" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subs_updated') THEN
        CREATE TRIGGER subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

-- 2. LICENSES
CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  token_hash TEXT NOT NULL UNIQUE,
  token_last4 TEXT NOT NULL,
  token_preview TEXT NOT NULL DEFAULT '',
  status public.license_status NOT NULL DEFAULT 'inactive',
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  max_devices INTEGER NOT NULL DEFAULT 1,
  last_validation TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own licenses select" ON public.licenses;
CREATE POLICY "own licenses select" ON public.licenses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'licenses_updated') THEN
        CREATE TRIGGER licenses_updated BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

-- 3. DEVICES
CREATE TABLE IF NOT EXISTS public.license_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  device_name TEXT,
  browser TEXT,
  os TEXT,
  extension_version TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ip_hash TEXT,
  status public.device_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (license_id, device_hash)
);
GRANT SELECT ON public.license_devices TO authenticated;
GRANT ALL ON public.license_devices TO service_role;
ALTER TABLE public.license_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own devices select" ON public.license_devices;
CREATE POLICY "own devices select" ON public.license_devices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.licenses l WHERE l.id = license_id AND l.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- 4. EVENTS
CREATE TABLE IF NOT EXISTS public.license_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL,
  device_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.license_events TO authenticated;
GRANT ALL ON public.license_events TO service_role;
ALTER TABLE public.license_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own events select" ON public.license_events;
CREATE POLICY "own events select" ON public.license_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 5. WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin webhooks select" ON public.webhook_events;
CREATE POLICY "admin webhooks select" ON public.webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans(id),
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_payment_id TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_idx ON public.payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own payments select" ON public.payments;
CREATE POLICY "own payments select" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payments_updated') THEN
        CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END
$$;

-- 7. RE-SEED PLANS (conveying existing logic)
INSERT INTO public.plans (slug,name,description,price,currency,duration_label,duration_days,is_lifetime,auto_renew,max_devices,highlights,sort_order) VALUES
('daily','Diário','Acesso completo por 1 dia.',9.90,'BRL','1 dia',1,false,false,1,ARRAY['Acesso por 24 horas','1 dispositivo','Todos os recursos'],1),
('monthly','Mensal','Acesso completo por 30 dias com renovação automática.',49.90,'BRL','30 dias',30,false,true,2,ARRAY['30 dias de acesso','Renovação automática','2 dispositivos','Suporte prioritário'],2),
('yearly','Anual','Acesso completo por 365 dias com renovação automática.',399.90,'BRL','365 dias',365,false,true,3,ARRAY['365 dias de acesso','Renovação automática','3 dispositivos','Economia de 33%'],3),
('lifetime','Vitalício','Acesso permanente, pagamento único.',999.90,'BRL','Permanente',NULL,true,false,5,ARRAY['Acesso permanente','5 dispositivos','Todas as atualizações futuras'],4)
ON CONFLICT (slug) DO NOTHING;
