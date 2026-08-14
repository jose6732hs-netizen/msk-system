CREATE TABLE public.push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid,
  recipient_role text NOT NULL DEFAULT 'user',
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  device_id uuid,
  endpoint text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  http_status integer,
  transaction_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_notification_logs TO authenticated;
GRANT ALL ON public.push_notification_logs TO service_role;

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view push logs"
ON public.push_notification_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_push_logs_created_at ON public.push_notification_logs (created_at DESC);
CREATE INDEX idx_push_logs_user ON public.push_notification_logs (user_id, created_at DESC);
CREATE INDEX idx_push_logs_tx ON public.push_notification_logs (transaction_id);
CREATE INDEX idx_push_logs_event ON public.push_notification_logs (event_type, created_at DESC);