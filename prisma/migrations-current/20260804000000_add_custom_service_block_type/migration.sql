ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'CUSTOM';

INSERT INTO "WorshipServiceBlock" ("id", "serviceId", "blockType", "label", "code", "order", "createdAt")
SELECT
  gen_random_uuid(),
  service."id",
  (block->>'blockType')::"BlockType",
  block->>'label',
  block->>'code',
  COALESCE((block->>'order')::integer, (ordinality - 1)::integer),
  NOW()
FROM "WorshipService" AS service
JOIN "ServiceTemplatePreset" AS template
  ON template."workspaceId" = service."workspaceId"
 AND template."code" = service."templatePresetCode"
CROSS JOIN LATERAL jsonb_array_elements(template."blocks") WITH ORDINALITY AS blocks(block, ordinality)
WHERE NOT EXISTS (
  SELECT 1
  FROM "WorshipServiceBlock" AS existing
  WHERE existing."serviceId" = service."id"
);
