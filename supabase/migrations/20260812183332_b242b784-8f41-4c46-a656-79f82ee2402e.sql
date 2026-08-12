update public.app_settings
set value = coalesce(value,'{}'::jsonb) || jsonb_build_object('support_whatsapp','64999117113','support_url','https://wa.me/5564999117113'),
    updated_at = now()
where key = 'config';