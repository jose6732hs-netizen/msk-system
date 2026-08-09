GRANT ALL ON SCHEMA public TO sandbox_exec;
GRANT USAGE ON SCHEMA auth TO sandbox_exec;
GRANT SELECT ON auth.users TO sandbox_exec;
GRANT anon, authenticated, service_role TO sandbox_exec;