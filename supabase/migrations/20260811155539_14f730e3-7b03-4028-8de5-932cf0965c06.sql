INSERT INTO public.user_roles (user_id, role)
SELECT '6922821c-f811-460f-8f31-3521bfe0a7e0'::uuid, 'super_admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '6922821c-f811-460f-8f31-3521bfe0a7e0'::uuid AND role = 'super_admin'::app_role
);