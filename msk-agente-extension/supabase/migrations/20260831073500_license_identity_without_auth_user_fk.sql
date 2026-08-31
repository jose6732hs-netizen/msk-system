alter table public.msk_projects
  drop constraint if exists msk_projects_user_id_fkey;

alter table public.msk_tasks
  drop constraint if exists msk_tasks_user_id_fkey;

alter table public.msk_github_installations
  drop constraint if exists msk_github_installations_user_id_fkey;
