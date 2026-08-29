DO $$ BEGIN
  CREATE TYPE "ProgramBlockTypeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProgramBlockVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "WorshipServiceBlock"
  ADD COLUMN IF NOT EXISTS "typeVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "fieldValues" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "ProgramBlockType" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProgramBlockTypeStatus" NOT NULL DEFAULT 'ACTIVE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramBlockType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProgramBlockTypeVersion" (
  "id" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "definition" JSONB NOT NULL,
  "status" "ProgramBlockVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramBlockTypeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceTemplateBlock" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "typeVersionId" TEXT NOT NULL,
  "label" TEXT,
  "order" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "fieldDefaults" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "ServiceTemplateBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramBlockType_workspaceId_key_key"
  ON "ProgramBlockType"("workspaceId", "key");
CREATE INDEX IF NOT EXISTS "ProgramBlockType_workspaceId_status_label_idx"
  ON "ProgramBlockType"("workspaceId", "status", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramBlockTypeVersion_typeId_version_key"
  ON "ProgramBlockTypeVersion"("typeId", "version");
CREATE INDEX IF NOT EXISTS "ProgramBlockTypeVersion_typeId_status_idx"
  ON "ProgramBlockTypeVersion"("typeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceTemplateBlock_templateId_order_key"
  ON "ServiceTemplateBlock"("templateId", "order");
CREATE INDEX IF NOT EXISTS "ServiceTemplateBlock_templateId_active_order_idx"
  ON "ServiceTemplateBlock"("templateId", "active", "order");

INSERT INTO "ProgramBlockType" ("id", "workspaceId", "key", "label", "isSystem", "updatedAt")
SELECT gen_random_uuid(), workspace."id", block."key", block."label", true, CURRENT_TIMESTAMP
FROM "Workspace" workspace
CROSS JOIN (VALUES
  ('CALL_TO_WORSHIP', 'Call to Worship'),
  ('PRAISE_AND_WORSHIP', 'Praise & Worship'),
  ('MC', 'Papuri At Pasasalamat'),
  ('AWIT_NG_HIMNO', 'Awit ng Himno'),
  ('TIPAN_PAHAYAG', 'Tipan/Pahayag'),
  ('AWIT_NG_PAKIKINIG', 'Awit ng Pakikinig'),
  ('SCRIPTURE_READING', 'Scripture Reading'),
  ('SERMON', 'Sermon'),
  ('AWIT_NG_PAGTUGON', 'Awit ng Pagtugon'),
  ('OFFERING', 'Offering'),
  ('FLOWERS_FOR_THE_LORD', 'Announcements'),
  ('DETAILS', 'Details'),
  ('PROGRAM_ITEM', 'Program Item')
) AS block("key", "label")
ON CONFLICT ("workspaceId", "key") DO NOTHING;

INSERT INTO "ProgramBlockTypeVersion" ("id", "typeId", "version", "definition", "status", "publishedAt")
SELECT gen_random_uuid(), type."id", 1, '{"fields": []}'::jsonb, 'PUBLISHED', CURRENT_TIMESTAMP
FROM "ProgramBlockType" type
WHERE type."isSystem" = true
  AND NOT EXISTS (
    SELECT 1 FROM "ProgramBlockTypeVersion" version WHERE version."typeId" = type."id"
  );

INSERT INTO "ServiceTemplateBlock" ("id", "templateId", "typeId", "typeVersionId", "label", "order", "active")
SELECT
  gen_random_uuid(),
  template."id",
  type."id",
  version."id",
  block->>'label',
  COALESCE((block->>'order')::integer, (ordinality - 1)::integer),
  true
FROM "ServiceTemplatePreset" template
CROSS JOIN LATERAL jsonb_array_elements(template."blocks") WITH ORDINALITY AS blocks(block, ordinality)
JOIN "ProgramBlockType" type
  ON type."workspaceId" = template."workspaceId"
 AND type."key" = CASE WHEN block->>'blockType' = 'CUSTOM' THEN 'PROGRAM_ITEM' ELSE block->>'blockType' END
JOIN "ProgramBlockTypeVersion" version
  ON version."typeId" = type."id" AND version."status" = 'PUBLISHED'
WHERE NOT EXISTS (
  SELECT 1 FROM "ServiceTemplateBlock" existing
  WHERE existing."templateId" = template."id"
);

UPDATE "WorshipServiceBlock" serviceBlock
SET "typeVersionId" = version."id"
FROM "WorshipService" service
JOIN "ProgramBlockType" type ON type."workspaceId" = service."workspaceId"
JOIN "ProgramBlockTypeVersion" version ON version."typeId" = type."id" AND version."status" = 'PUBLISHED'
WHERE serviceBlock."serviceId" = service."id"
  AND type."key" = CASE WHEN serviceBlock."blockType" = 'CUSTOM' THEN 'PROGRAM_ITEM' ELSE serviceBlock."blockType"::text END
  AND serviceBlock."typeVersionId" IS NULL;

ALTER TABLE "ProgramBlockType"
  ADD CONSTRAINT "ProgramBlockType_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramBlockTypeVersion"
  ADD CONSTRAINT "ProgramBlockTypeVersion_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "ProgramBlockType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTemplateBlock"
  ADD CONSTRAINT "ServiceTemplateBlock_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ServiceTemplatePreset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceTemplateBlock_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "ProgramBlockType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ServiceTemplateBlock_typeVersionId_fkey"
  FOREIGN KEY ("typeVersionId") REFERENCES "ProgramBlockTypeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceBlock"
  ADD CONSTRAINT "WorshipServiceBlock_typeVersionId_fkey"
  FOREIGN KEY ("typeVersionId") REFERENCES "ProgramBlockTypeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
