-- Workspace-owned integration overrides; secrets are application-encrypted.
CREATE TYPE "WorkspaceIntegrationProvider" AS ENUM ('OPENAI', 'GEMINI');

CREATE TABLE "WorkspaceIntegration" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" "WorkspaceIntegrationProvider" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "apiKeyCiphertext" TEXT,
  "extractorModel" TEXT,
  "backgroundImageModel" TEXT,
  "backgroundVideoModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceIntegration_workspaceId_provider_key" ON "WorkspaceIntegration"("workspaceId", "provider");
CREATE INDEX "WorkspaceIntegration_workspaceId_enabled_idx" ON "WorkspaceIntegration"("workspaceId", "enabled");
ALTER TABLE "WorkspaceIntegration" ADD CONSTRAINT "WorkspaceIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill normalized template blocks from the legacy JSON document once.
INSERT INTO "ServiceTemplateBlock" ("id", "templateId", "typeId", "typeVersionId", "label", "order", "active", "fieldDefaults")
SELECT
  gen_random_uuid()::text,
  t."id",
  p."id",
  v."id",
  NULLIF(TRIM(block->>'label'), ''),
  ROW_NUMBER() OVER (PARTITION BY t."id" ORDER BY COALESCE((block->>'order')::int, source.ordinality), source.ordinality) - 1,
  true,
  COALESCE(block->'fieldDefaults', '{}'::jsonb)
FROM "ServiceTemplatePreset" t
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t."blocks") = 'array' THEN t."blocks" ELSE '[]'::jsonb END) WITH ORDINALITY source(block, ordinality)
JOIN "ProgramBlockType" p ON p."workspaceId" = t."workspaceId"
  AND p."key" = CASE COALESCE(block->>'blockType', '')
    WHEN 'CUSTOM' THEN 'PROGRAM_ITEM'
    ELSE COALESCE(block->>'blockType', 'PROGRAM_ITEM')
  END
JOIN LATERAL (
  SELECT version."id"
  FROM "ProgramBlockTypeVersion" version
  WHERE version."typeId" = p."id" AND version."status" = 'PUBLISHED'
  ORDER BY version."version" DESC
  LIMIT 1
) v ON true
WHERE NOT EXISTS (
  SELECT 1 FROM "ServiceTemplateBlock" existing WHERE existing."templateId" = t."id"
);
