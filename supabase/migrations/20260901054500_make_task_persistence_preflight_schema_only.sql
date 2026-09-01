CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.msk_task_persistence_probe(
  p_project_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_missing text[];
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

  IF to_regclass('public.msk_tasks') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', '42P01',
      'message', 'Tabela public.msk_tasks não existe.'
    );
  END IF;

  SELECT array_agg(required.column_name ORDER BY required.column_name)
  INTO v_missing
  FROM (
    VALUES
      ('id'),
      ('lovable_project_id'),
      ('user_id'),
      ('command'),
      ('status'),
      ('created_at'),
      ('updated_at'),
      ('error_code'),
      ('error_stage'),
      ('retry_count'),
      ('last_error_id')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'msk_tasks'
      AND c.column_name = required.column_name
  );

  IF v_missing IS NOT NULL AND array_length(v_missing, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'PGRST204',
      'message', 'Schema de msk_tasks incompleto.',
      'missing_columns', to_jsonb(v_missing)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'DATABASE_SCHEMA_READY',
    'mode', 'schema_only',
    'write_check', 'deferred_to_executor'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', SQLSTATE,
      'message', SQLERRM
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.msk_task_persistence_probe(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.msk_task_persistence_probe(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.msk_task_persistence_probe(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.msk_task_persistence_probe(uuid, uuid) TO service_role;

DO $check$
DECLARE
  v_project uuid;
  v_user uuid;
  v_result jsonb;
BEGIN
  SELECT lovable_project_id, user_id
    INTO v_project, v_user
  FROM public.msk_projects
  WHERE user_id IS NOT NULL
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_project IS NOT NULL AND v_user IS NOT NULL THEN
    v_result := public.msk_task_persistence_probe(v_project, v_user);
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'MSK schema-only preflight validation failed: %', v_result::text;
    END IF;
  END IF;
END;
$check$;
