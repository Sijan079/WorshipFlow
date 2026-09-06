-- These tables are accessed through authenticated Next.js route handlers.
-- Do not expose their rows directly through the Supabase Data API.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ErrorNotification',
    'FeedbackRateLimit',
    'ProgramBlockType',
    'ProgramBlockTypeVersion',
    'ServiceTemplateBlock',
    'WorkspaceIntegration'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END
$$;
