drop policy if exists "MSK admins manage affiliate commissions" on public.affiliate_commissions;
create policy "MSK admins manage affiliate commissions" on public.affiliate_commissions for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage affiliates" on public.affiliates;
create policy "MSK admins manage affiliates" on public.affiliates for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage app settings" on public.app_settings;
create policy "MSK admins manage app settings" on public.app_settings for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage license devices" on public.license_devices;
create policy "MSK admins manage license devices" on public.license_devices for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage license events" on public.license_events;
create policy "MSK admins manage license events" on public.license_events for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage licenses" on public.licenses;
create policy "MSK admins manage licenses" on public.licenses for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage plans" on public.plans;
create policy "MSK admins manage plans" on public.plans for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage profiles" on public.profiles;
create policy "MSK admins manage profiles" on public.profiles for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage subscriptions" on public.subscriptions;
create policy "MSK admins manage subscriptions" on public.subscriptions for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage transactions" on public.transactions;
create policy "MSK admins manage transactions" on public.transactions for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins manage user roles" on public.user_roles;
create policy "MSK admins manage user roles" on public.user_roles for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "MSK admins read webhooks" on public.webhook_events;
create policy "MSK admins read webhooks" on public.webhook_events for select to authenticated using (public.is_admin(auth.uid()));
