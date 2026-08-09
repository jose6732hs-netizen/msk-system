CREATE TABLE public.affiliate_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    min_sales integer NOT NULL DEFAULT 0,
    min_revenue decimal(12,2) NOT NULL DEFAULT 0,
    commission_rate decimal(5,2) NOT NULL,
    badge_color text NOT NULL DEFAULT '#3b82f6',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS tier_id uuid REFERENCES public.affiliate_tiers(id);

GRANT SELECT ON public.affiliate_tiers TO authenticated;
GRANT ALL ON public.affiliate_tiers TO service_role;

ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can select tiers"
ON public.affiliate_tiers FOR SELECT TO authenticated USING (true);

INSERT INTO public.affiliate_tiers (name, min_sales, min_revenue, commission_rate, badge_color)
VALUES 
('Bronze', 0, 0, 30.00, '#cd7f32'),
('Prata', 10, 500, 35.00, '#c0c0c0'),
('Ouro', 50, 2500, 40.00, '#ffd700'),
('Diamante', 200, 10000, 50.00, '#b9f2ff');
