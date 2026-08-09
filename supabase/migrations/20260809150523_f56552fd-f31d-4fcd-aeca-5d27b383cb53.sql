-- 1. Attribution settings in app_settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES ('affiliate_settings', '{"attribution_window_days": 30, "model": "last_click"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Affiliate Attributions table
CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    visitor_id text, -- session or cookie id
    landing_page text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    attributed_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_attributions TO authenticated;
GRANT ALL ON public.affiliate_attributions TO service_role;
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage attributions" ON public.affiliate_attributions
    TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Affiliates can view their own attributions" ON public.affiliate_attributions
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_attributions.affiliate_id AND a.user_id = auth.uid())
    );

-- 3. Affiliate Conversions (linking actual sales to affiliates)
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
    amount numeric(12,2) NOT NULL,
    commission_amount numeric(12,2) NOT NULL,
    status text NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REVERSED
    converted_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    UNIQUE(transaction_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_conversions TO authenticated;
GRANT ALL ON public.affiliate_conversions TO service_role;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage conversions" ON public.affiliate_conversions
    TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Affiliates can view their own conversions" ON public.affiliate_conversions
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_conversions.affiliate_id AND a.user_id = auth.uid())
    );

-- 4. Affiliate Audit Events
CREATE TABLE IF NOT EXISTS public.affiliate_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL, -- signup, click, conversion, commission, payout
    resource_id uuid, -- link to transaction, click, etc
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_events TO authenticated;
GRANT ALL ON public.affiliate_events TO service_role;
ALTER TABLE public.affiliate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage affiliate events" ON public.affiliate_events
    TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Affiliates can view their own events" ON public.affiliate_events
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_events.affiliate_id AND a.user_id = auth.uid())
    );

-- 5. Add missing columns to affiliates if any
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'blocked_at') THEN
        ALTER TABLE public.affiliates ADD COLUMN blocked_at timestamp with time zone;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'notes') THEN
        ALTER TABLE public.affiliates ADD COLUMN notes text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'goal_amount') THEN
        ALTER TABLE public.affiliates ADD COLUMN goal_amount numeric(12,2) DEFAULT 0;
    END IF;
END $$;
