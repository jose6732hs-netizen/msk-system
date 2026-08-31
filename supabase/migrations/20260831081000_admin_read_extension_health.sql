drop policy if exists "Admins can read extension installations" on public.extension_installations;
create policy "Admins can read extension installations"
on public.extension_installations
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read extension errors" on public.extension_errors;
create policy "Admins can read extension errors"
on public.extension_errors
for select
to authenticated
using (public.is_admin(auth.uid()));
