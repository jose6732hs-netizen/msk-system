
-- 1. Ensure the app_role enum has 'admin' if not already present
-- (Assuming app_role and user_roles follow the Lovable instructions)

-- 2. CREATE TABLE affiliate_wallets
CREATE TABLE IF NOT EXISTS public.affiliate_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    available_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    pending_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    requested_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_earned numeric(15,2) DEFAULT 0.00 NOT NULL,
    total_withdrawn numeric(15,2) DEFAULT 0.00 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (affiliate_id)
);

GRANT SELECT, INSERT, UPDATE ON public.affiliate_wallets TO authenticated;
GRANT ALL ON public.affiliate_wallets TO service_role;
ALTER TABLE public.affiliate_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Afiliados podem ver suas próprias carteiras"
ON public.affiliate_wallets FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem tudo em affiliate_wallets"
ON public.affiliate_wallets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. CREATE TABLE affiliate_wallet_transactions
CREATE TABLE IF NOT EXISTS public.affiliate_wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    wallet_id uuid REFERENCES public.affiliate_wallets(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'commission', 'withdrawal_request', 'withdrawal_paid', 'withdrawal_cancelled', 'refund', 'adjustment', 'reversal'
    amount numeric(15,2) NOT NULL,
    balance_before numeric(15,2) NOT NULL,
    balance_after numeric(15,2) NOT NULL,
    payment_id uuid, -- Reference to the transaction/payment table if available
    commission_id uuid, -- Reference to affiliate_commissions
    withdrawal_id uuid, -- Reference to affiliate_withdrawals
    description text,
    status text DEFAULT 'completed' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT ON public.affiliate_wallet_transactions TO authenticated;
GRANT ALL ON public.affiliate_wallet_transactions TO service_role;
ALTER TABLE public.affiliate_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Afiliados podem ver suas transações"
ON public.affiliate_wallet_transactions FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem tudo em affiliate_wallet_transactions"
ON public.affiliate_wallet_transactions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. CREATE TABLE affiliate_withdrawals
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    wallet_id uuid REFERENCES public.affiliate_wallets(id) ON DELETE CASCADE NOT NULL,
    amount numeric(15,2) NOT NULL,
    pix_key text NOT NULL,
    pix_key_type text NOT NULL,
    status text DEFAULT 'pending' NOT NULL, -- 'pending', 'approved', 'paid', 'rejected', 'cancelled'
    admin_id uuid REFERENCES auth.users(id),
    admin_note text,
    requested_at timestamptz DEFAULT now() NOT NULL,
    approved_at timestamptz,
    paid_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT ON public.affiliate_withdrawals TO authenticated;
GRANT ALL ON public.affiliate_withdrawals TO service_role;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Afiliados podem ver e criar seus saques"
ON public.affiliate_withdrawals FOR SELECT TO authenticated
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Afiliados podem criar seus saques"
ON public.affiliate_withdrawals FOR INSERT TO authenticated
WITH CHECK (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem tudo em affiliate_withdrawals"
ON public.affiliate_withdrawals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add payment_id to affiliate_commissions if missing, and adjust status
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS available_at timestamptz;
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS commission_amount numeric(15,2);

-- Trigger to create wallet automatically
CREATE OR REPLACE FUNCTION public.create_affiliate_wallet_on_affiliate_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.affiliate_wallets (affiliate_id)
    VALUES (NEW.id)
    ON CONFLICT (affiliate_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_create_affiliate_wallet
AFTER INSERT ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.create_affiliate_wallet_on_affiliate_creation();

-- Create wallets for existing affiliates
INSERT INTO public.affiliate_wallets (affiliate_id)
SELECT id FROM public.affiliates
ON CONFLICT (affiliate_id) DO NOTHING;
