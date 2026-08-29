DO $$ BEGIN
  CREATE TYPE "TemplateBlockKind" AS ENUM ('PERSON', 'TEXT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ServiceTemplateBlock"
  ADD COLUMN IF NOT EXISTS "kind" "TemplateBlockKind" NOT NULL DEFAULT 'TEXT';

ALTER TABLE "WorshipServiceBlock"
  ADD COLUMN IF NOT EXISTS "kind" "TemplateBlockKind" NOT NULL DEFAULT 'TEXT';

-- Existing templates and service snapshots intentionally become text blocks.
-- Their labels, ordering, definitions, and stored values remain intact.
