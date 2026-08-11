ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS withdrawal_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_blocked_at timestamp with time zone;