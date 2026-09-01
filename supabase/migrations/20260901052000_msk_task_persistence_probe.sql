CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.msk_task_persistence_probe(
  p_project_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_probe_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.msk_projects
    WHERE lovable_project_id = p_project_id
      AND (user_id = p_user_id OR user_id IS NULL)
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'PROJECT_OWNERSHIP_MISMATCH',
      'message', 'Projeto não pertence ao usuário informado.'
    );
  END IF;

  BEGIN
    INSERT INTO public.msk_tasks (
      id,
      lovable_project_id,
      user_id,
      command,
      status,
      error,
      error_code,
      error_stage,
      retry_count,
      last_error_id,
      updated_at
    ) VALUES (
      v_probe_id,
      p_project_id,
      p_user_id,
      '__MSK_PERSISTENCE_PROBE__',
      'locating_files',
      NULL,
      NULL,
      NULL,
      0,
      NULL,
      now()
    );

    RAISE EXCEPTION 'MSK_PERSISTENCE_PROBE_ROLLBACK';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'MSK_PERSISTENCE_PROBE_ROLLBACK' THEN
        RETURN jsonb_build_object('ok', true, 'code', 'DATABASE_WRITE_READY');
      END IF;
      RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
  END;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.msk_task_persistence_probe(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.msk_task_persistence_probe(uuid, uuid) TO service_role;
