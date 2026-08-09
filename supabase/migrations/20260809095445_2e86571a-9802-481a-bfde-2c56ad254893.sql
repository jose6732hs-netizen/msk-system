-- Drop the existing role for this specific user if it exists to ensure a clean slate
DELETE FROM public.user_roles WHERE user_id = '27306a96-c4ac-482e-a2a6-7f450397f938' AND role = 'super_admin';

-- Insert the super_admin role for jose6732hs@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('27306a96-c4ac-482e-a2a6-7f450397f938', 'super_admin');

-- Ensure he also has the 'user' role for common queries
INSERT INTO public.user_roles (user_id, role)
VALUES ('27306a96-c4ac-482e-a2a6-7f450397f938', 'user')
ON CONFLICT DO NOTHING;
