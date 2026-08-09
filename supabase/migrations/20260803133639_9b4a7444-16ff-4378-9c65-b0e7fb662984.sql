insert into public.user_roles (user_id, role)
values ('694755ab-0f80-49c9-9cec-b08123058215','super_admin'::app_role),
       ('694755ab-0f80-49c9-9cec-b08123058215','admin'::app_role)
on conflict (user_id, role) do nothing;