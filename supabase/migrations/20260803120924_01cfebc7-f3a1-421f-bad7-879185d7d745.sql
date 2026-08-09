-- 1. Roles adicionais
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'producer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reseller';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'affiliate';