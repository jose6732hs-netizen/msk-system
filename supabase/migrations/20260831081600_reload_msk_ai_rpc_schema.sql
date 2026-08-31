-- Garante que RPCs recém-criados do MSK IA fiquem visíveis imediatamente ao PostgREST.
-- Mantém acesso restrito ao papel authenticated; as próprias funções validam admin/super_admin.

grant usage on schema public to authenticated;
grant execute on function public.msk_ai_settings_status() to authenticated;
grant execute on function public.msk_ai_settings_save(text,text,text,text) to authenticated;
grant execute on function public.msk_ai_settings_delete() to authenticated;

notify pgrst, 'reload schema';
