DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Obter o ID do usuário pelo e-mail
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'jose6732hs@gmail.com';

    IF target_user_id IS NOT NULL THEN
        -- Garantir que ele tenha o papel de super_admin
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'super_admin')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- Garantir que ele também tenha o papel de user (padrão)
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'user')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'Usuário jose6732hs@gmail.com promovido a super_admin.';
    ELSE
        RAISE NOTICE 'Usuário jose6732hs@gmail.com não encontrado.';
    END IF;
END $$;