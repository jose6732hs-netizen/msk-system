-- Create a trigger function to promote the first user to super_admin
CREATE OR REPLACE FUNCTION public.promote_first_user_to_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users in user_roles
  SELECT count(*) INTO user_count FROM public.user_roles;
  
  -- If this is the first user (count 0 before insert), add super_admin role
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on user_roles insert
DROP TRIGGER IF EXISTS on_first_user_roles_created ON public.user_roles;
CREATE TRIGGER on_first_user_roles_created
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.promote_first_user_to_super_admin();

-- Also update handle_new_user to ensure the very first user gets super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Check if this is the first user in auth.users
  SELECT NOT EXISTS (SELECT 1 FROM auth.users WHERE id <> NEW.id LIMIT 1) INTO is_first_user;

  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Default role 'user'
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  -- If first user, also give super_admin
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;
