import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDir = join(process.cwd(), 'prisma', 'migrations-current');
const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const programTypes = migrations.find((name) => name.includes('_add_program_block_types'));
const normalizedTemplates = migrations.find((name) => name.includes('_add_workspace_integrations_and_normalize_template_blocks'));
const removeSystemTypes = migrations.find((name) => name.includes('_remove_system_program_block_types'));

if (!programTypes || !normalizedTemplates || !removeSystemTypes) {
  throw new Error('Expected program block migration chain is incomplete.');
}

const position = (migration) => migrations.indexOf(migration);
if (!(position(programTypes) < position(normalizedTemplates) && position(normalizedTemplates) < position(removeSystemTypes))) {
  throw new Error('Program block types must be created before normalized template blocks, before system types are removed.');
}

const programSql = await readFile(join(migrationsDir, programTypes, 'migration.sql'), 'utf8');
const normalizedSql = await readFile(join(migrationsDir, normalizedTemplates, 'migration.sql'), 'utf8');

for (const marker of ['INSERT INTO "ProgramBlockType"', 'INSERT INTO "ProgramBlockTypeVersion"', 'INSERT INTO "ServiceTemplateBlock"']) {
  if (!programSql.includes(marker)) throw new Error(`Program migration lost backfill: ${marker}`);
}
if (!normalizedSql.includes('CREATE TABLE "WorkspaceIntegration"')) {
  throw new Error('Workspace integration table creation is missing.');
}
if (!normalizedSql.includes('INSERT INTO "ServiceTemplateBlock"')) {
  throw new Error('Normalized template block backfill is missing.');
}

console.log('Current migration order and backfills verified.');
