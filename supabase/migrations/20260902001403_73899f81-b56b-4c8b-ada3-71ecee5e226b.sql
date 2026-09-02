revoke all on function public.msk_task_persistence_probe(uuid, uuid) from public, anon, authenticated;
grant execute on function public.msk_task_persistence_probe(uuid, uuid) to service_role;
revoke all on function public.msk_touch_updated_at() from public, anon, authenticated;