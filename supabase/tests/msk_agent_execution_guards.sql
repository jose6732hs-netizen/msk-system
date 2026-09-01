BEGIN;

DO $$
DECLARE
  v_project uuid;
  v_user uuid;
  v_task uuid := gen_random_uuid();
  v_count integer;
BEGIN
  SELECT lovable_project_id, user_id
    INTO v_project, v_user
  FROM public.msk_projects
  WHERE user_id IS NOT NULL
  LIMIT 1;

  IF v_project IS NULL THEN
    RAISE NOTICE 'SKIP: no owned MSK project available for execution guard test';
    RETURN;
  END IF;

  INSERT INTO public.msk_tasks(id, lovable_project_id, user_id, command, status, retry_count, updated_at)
  VALUES(v_task, v_project, v_user, 'teste de checkpoint', 'locating_files', 0, now());

  UPDATE public.msk_tasks SET status='analyzing', updated_at=now() WHERE id=v_task;
  UPDATE public.msk_tasks SET status='editing', updated_at=now() WHERE id=v_task;
  UPDATE public.msk_tasks SET status='validating', updated_at=now() WHERE id=v_task;
  UPDATE public.msk_tasks SET status='finalizing', updated_at=now() WHERE id=v_task;
  UPDATE public.msk_tasks SET status='committing', branch_name='main', updated_at=now() WHERE id=v_task;
  UPDATE public.msk_tasks SET status='verifying', updated_at=now() WHERE id=v_task;
  UPDATE public.msk_tasks SET status='completed', summary='teste concluído', updated_at=now() WHERE id=v_task;

  SELECT count(*) INTO v_count FROM public.msk_agent_checkpoints WHERE task_id=v_task;
  IF v_count < 7 THEN
    RAISE EXCEPTION 'checkpoint test failed: expected >=7 rows, got %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.msk_agent_checkpoints
    WHERE task_id=v_task AND to_status='validating'
  ) THEN
    RAISE EXCEPTION 'checkpoint test failed: validating checkpoint missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.msk_agent_checkpoints
    WHERE task_id=v_task AND to_status='completed'
  ) THEN
    RAISE EXCEPTION 'checkpoint test failed: completed checkpoint missing';
  END IF;

  UPDATE public.msk_tasks
     SET status='completed_no_change', summary='estado atual já satisfaz o pedido', updated_at=now()
   WHERE id=v_task;

  IF NOT EXISTS (
    SELECT 1 FROM public.msk_agent_checkpoints
    WHERE task_id=v_task AND to_status='completed_no_change'
  ) THEN
    RAISE EXCEPTION 'checkpoint test failed: completed_no_change missing';
  END IF;
END $$;

SELECT public.msk_agent_health_snapshot() AS health_snapshot_contract;

ROLLBACK;
