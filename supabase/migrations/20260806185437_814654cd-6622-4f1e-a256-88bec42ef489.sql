INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
CROSS JOIN (VALUES ('admin'::app_role), ('super_admin'::app_role)) AS r(role)
WHERE u.email = 'jose6732hs@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;