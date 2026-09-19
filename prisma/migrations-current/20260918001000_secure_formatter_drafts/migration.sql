-- Only server-side Prisma may read these private, temporary documents.
-- No direct Data API policies: membership/ownership is checked by REST handlers.
ALTER TABLE "FormatterConversion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormatterDraft" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "FormatterConversion", "FormatterDraft" FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "FormatterConversion", "FormatterDraft" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
