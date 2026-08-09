CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT 'user',
  type text NOT NULL DEFAULT 'system',
  priority text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  body text NOT NULL,
  emoji text,
  image_url text,
  link text,
  status text NOT NULL DEFAULT 'sent',
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  push_status text,
  push_error text,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON public.notifications(status, scheduled_at);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER notifications_updated BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  campaign_id text,
  sale_amount numeric NOT NULL DEFAULT 0,
  commission_percentage numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  origin text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_finance TO authenticated;
GRANT ALL ON public.notification_finance TO service_role;
ALTER TABLE public.notification_finance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read notification finance" ON public.notification_finance FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  browser text,
  platform text,
  user_agent text,
  active boolean NOT NULL DEFAULT true,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_devices_user ON public.push_devices(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices read" ON public.push_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own devices write" ON public.push_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own devices update" ON public.push_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own devices delete" ON public.push_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER push_devices_updated BEFORE UPDATE ON public.push_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sales boolean NOT NULL DEFAULT true,
  payments boolean NOT NULL DEFAULT true,
  commissions boolean NOT NULL DEFAULT true,
  messages boolean NOT NULL DEFAULT true,
  campaigns boolean NOT NULL DEFAULT true,
  updates boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own prefs insert" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs update" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER notification_preferences_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();