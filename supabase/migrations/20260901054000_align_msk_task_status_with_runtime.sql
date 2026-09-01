-- Align msk_tasks status constraint with the states emitted by the current MSK agent runtime.
alter table public.msk_tasks drop constraint if exists msk_tasks_status_check;

alter table public.msk_tasks add constraint msk_tasks_status_check check (status = any (array[
  'queued'::text,
  'locating_files'::text,
  'analyzing'::text,
  'editing'::text,
  'self_correcting'::text,
  'no_changes_retry'::text,
  'validating'::text,
  'committing'::text,
  'verifying'::text,
  'finalizing'::text,
  'awaiting_approval'::text,
  'completed'::text,
  'failed'::text
]));
