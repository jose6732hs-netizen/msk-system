DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO sandbox_exec, postgres, anon, authenticated, service_role;