-- The persistence probe is server-only. Edge Functions call it with the service role.
revoke all on function public.msk_task_persistence_probe(uuid, uuid) from public;
revoke all on function public.msk_task_persistence_probe(uuid, uuid) from anon;
revoke all on function public.msk_task_persistence_probe(uuid, uuid) from authenticated;
grant execute on function public.msk_task_persistence_probe(uuid, uuid) to service_role;
