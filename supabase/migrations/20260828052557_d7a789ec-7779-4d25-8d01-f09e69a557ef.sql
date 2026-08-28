
CREATE TABLE IF NOT EXISTS public.extension_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installation_id text NOT NULL UNIQUE,
  license_id uuid,
  version text,
  browser text,
  os text,
  last_seen_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extension_installations_user_idx ON public.extension_installations(user_id);
CREATE INDEX IF NOT EXISTS extension_installations_seen_idx ON public.extension_installations(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.extension_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installation_id text NOT NULL,
  lovable_project_id text NOT NULL,
  project_name text,
  repository text,
  provider text,
  branch text,
  github_status text DEFAULT 'unknown',
  workspace_url text,
  preview_url text,
  publish_status text DEFAULT 'unknown',
  last_commit_sha text,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, installation_id, lovable_project_id)
);
CREATE INDEX IF NOT EXISTS extension_projects_user_idx ON public.extension_projects(user_id);

CREATE TABLE IF NOT EXISTS public.extension_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installation_id text NOT NULL,
  extension_version text,
  project_id text,
  repository text,
  provider text,
  action text NOT NULL,
  status text,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extension_events_created_idx ON public.extension_events(created_at DESC);
CREATE INDEX IF NOT EXISTS extension_events_user_idx ON public.extension_events(user_id);

CREATE TABLE IF NOT EXISTS public.extension_error_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code text NOT NULL UNIQUE,
  title text NOT NULL,
  user_message text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  recovery_action text DEFAULT 'retry',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id uuid NOT NULL DEFAULT gen_random_uuid(),
  error_code text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  title text,
  user_id uuid NOT NULL,
  installation_id text NOT NULL,
  project_id text,
  repository text,
  provider text,
  extension_version text,
  browser text,
  action text,
  user_message text,
  technical_message text,
  stack_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extension_errors_code_idx ON public.extension_errors(error_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.extension_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  status text NOT NULL DEFAULT 'open',
  affected_users integer NOT NULL DEFAULT 0,
  affected_installations integer NOT NULL DEFAULT 0,
  dominant_version text,
  dominant_browser text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  message text,
  incident_id uuid REFERENCES public.extension_incidents(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text,
  changelog text,
  build_id uuid,
  mandatory boolean NOT NULL DEFAULT false,
  minimum_version text,
  download_url text,
  status text NOT NULL DEFAULT 'draft',
  released_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.extension_remote_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installation_id text,
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  block_message text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS extension_remote_controls_global_idx
  ON public.extension_remote_controls(user_id) WHERE installation_id IS NULL;

CREATE TABLE IF NOT EXISTS public.extension_remote_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installation_id text,
  command_type text NOT NULL,
  title text,
  message text,
  severity text NOT NULL DEFAULT 'info',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  delivery_count integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extension_remote_commands_user_idx ON public.extension_remote_commands(user_id, status);

GRANT ALL ON public.extension_installations TO service_role;
GRANT ALL ON public.extension_projects TO service_role;
GRANT ALL ON public.extension_events TO service_role;
GRANT ALL ON public.extension_error_catalog TO service_role;
GRANT ALL ON public.extension_errors TO service_role;
GRANT ALL ON public.extension_incidents TO service_role;
GRANT ALL ON public.extension_alerts TO service_role;
GRANT ALL ON public.extension_releases TO service_role;
GRANT ALL ON public.extension_remote_controls TO service_role;
GRANT ALL ON public.extension_remote_commands TO service_role;

GRANT SELECT ON public.extension_installations TO authenticated;
GRANT SELECT ON public.extension_projects TO authenticated;
GRANT SELECT ON public.extension_events TO authenticated;
GRANT SELECT ON public.extension_errors TO authenticated;
GRANT SELECT ON public.extension_remote_commands TO authenticated;
GRANT SELECT ON public.extension_releases TO authenticated;

ALTER TABLE public.extension_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_error_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_remote_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_remote_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own installations" ON public.extension_installations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects" ON public.extension_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own events" ON public.extension_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own errors" ON public.extension_errors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own commands" ON public.extension_remote_commands FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "released versions" ON public.extension_releases FOR SELECT TO authenticated USING (status = 'released');
