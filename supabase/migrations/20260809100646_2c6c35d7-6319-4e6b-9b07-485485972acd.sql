-- 1. Ajusta a tabela de planos para garantir que o plano free-test seja realmente 0 e tenha trial habilitado
UPDATE public.plans 
SET price = 0, allow_trial = true 
WHERE slug = 'free-test';

-- 2. Promoção do primeiro usuário a super_admin (se ainda não existir)
CREATE OR REPLACE FUNCTION public.promote_first_user_to_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_promote_first_admin ON public.profiles;
CREATE TRIGGER tr_promote_first_admin
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.promote_first_user_to_super_admin();
