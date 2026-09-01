ALTER TABLE public.extension_errors REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_errors;