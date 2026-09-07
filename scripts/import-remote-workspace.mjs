import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const APP_TABLES_TO_CLEAR = [
  "ErrorNotification", "FeedbackRateLimit", "GeneratedOutput", "AutomationJob", "ServiceAsset", "PAPInboxScreenshot",
  "SongFile", "WorshipServiceSong", "WorshipServiceDetail", "ServiceBibleVerse", "ServiceServantAssignment", "ServiceHymnal",
  "BlockPerson", "WorshipServiceBlock", "WorshipService", "ServiceTemplateBlock", "ProgramBlockTypeVersion", "ProgramBlockType",
  "ServiceTemplatePreset", "ChecklistItemPreset", "ChecklistPreset", "Song", "SongTagPreset", "Servant", "ServantGroupPreset",
  "MinistryPreset", "WorkspaceIntegration", "WorkspaceInvitation", "WorkspaceMembership", "User", "Workspace",
];

// File-backed records require a separate Storage-object copy. Encrypted integration
// values cannot be reused safely without the original local encryption key.
const SKIPPED_TABLES = ["WorkspaceIntegration", "SongFile", "ServiceAsset", "PapInboxScreenshot", "AutomationJob", "GeneratedOutput", "ErrorNotification", "FeedbackRateLimit"];

function readEnvFile(fileName) {
  const entries = {};
  for (const line of readFileSync(path.resolve(fileName), "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    entries[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return entries;
}

function requireArg(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing ${name}.`);
  return value.trim();
}

function hasArg(name) {
  return process.argv.includes(name);
}

function quoteIdentifier(value) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function qualified(table) {
  return `public.${quoteIdentifier(table)}`;
}

async function selectByIds(client, table, column, ids) {
  if (ids.length === 0) return [];
  const result = await client.query(`SELECT * FROM ${qualified(table)} WHERE ${quoteIdentifier(column)} = ANY($1::text[])`, [ids]);
  return result.rows;
}

async function insertRows(client, table, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const values = columns.map((column) => row[column]);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    await client.query(
      `INSERT INTO ${qualified(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders.join(", ")})`,
      values,
    );
  }
}

async function buildImportData(remote, email) {
  const memberships = await remote.query(
    `SELECT membership.*
       FROM ${qualified("WorkspaceMembership")} AS membership
       JOIN ${qualified("User")} AS user_record ON user_record.id = membership."userId"
      WHERE LOWER(user_record.email) = LOWER($1) AND membership.status = 'ACTIVE'`,
    [email],
  );
  const workspaceIds = [...new Set(memberships.rows.map((row) => row.workspaceId))];
  if (workspaceIds.length === 0) throw new Error(`No active remote workspace membership exists for ${email}.`);

  const data = new Map();
  data.set("WorkspaceMembership", await selectByIds(remote, "WorkspaceMembership", "workspaceId", workspaceIds));
  data.set("WorkspaceInvitation", await selectByIds(remote, "WorkspaceInvitation", "workspaceId", workspaceIds));

  const referencedUserIds = [...new Set([
    ...data.get("WorkspaceMembership").map((row) => row.userId),
    ...data.get("WorkspaceInvitation").map((row) => row.invitedByUserId).filter(Boolean),
  ])];
  data.set("User", await selectByIds(remote, "User", "id", referencedUserIds));
  data.set("Workspace", await selectByIds(remote, "Workspace", "id", workspaceIds));
  data.set("SongTagPreset", await selectByIds(remote, "SongTagPreset", "workspaceId", workspaceIds));
  data.set("MinistryPreset", await selectByIds(remote, "MinistryPreset", "workspaceId", workspaceIds));
  data.set("ServantGroupPreset", await selectByIds(remote, "ServantGroupPreset", "workspaceId", workspaceIds));
  data.set("ChecklistPreset", await selectByIds(remote, "ChecklistPreset", "workspaceId", workspaceIds));
  data.set("ServiceTemplatePreset", await selectByIds(remote, "ServiceTemplatePreset", "workspaceId", workspaceIds));
  data.set("ProgramBlockType", await selectByIds(remote, "ProgramBlockType", "workspaceId", workspaceIds));
  data.set("WorshipService", await selectByIds(remote, "WorshipService", "workspaceId", workspaceIds));
  data.set("Song", await selectByIds(remote, "Song", "workspaceId", workspaceIds));
  data.set("Servant", await selectByIds(remote, "Servant", "workspaceId", workspaceIds));

  const checklistIds = data.get("ChecklistPreset").map((row) => row.id);
  const templateIds = data.get("ServiceTemplatePreset").map((row) => row.id);
  const typeIds = data.get("ProgramBlockType").map((row) => row.id);
  const serviceIds = data.get("WorshipService").map((row) => row.id);
  data.set("ChecklistItemPreset", await selectByIds(remote, "ChecklistItemPreset", "checklistId", checklistIds));
  data.set("ProgramBlockTypeVersion", await selectByIds(remote, "ProgramBlockTypeVersion", "typeId", typeIds));
  data.set("ServiceTemplateBlock", await selectByIds(remote, "ServiceTemplateBlock", "templateId", templateIds));
  data.set("WorshipServiceBlock", await selectByIds(remote, "WorshipServiceBlock", "serviceId", serviceIds));
  data.set("WorshipServiceSong", await selectByIds(remote, "WorshipServiceSong", "serviceId", serviceIds));
  data.set("WorshipServiceDetail", await selectByIds(remote, "WorshipServiceDetail", "serviceId", serviceIds));
  data.set("ServiceBibleVerse", await selectByIds(remote, "ServiceBibleVerse", "serviceId", serviceIds));
  data.set("ServiceServantAssignment", await selectByIds(remote, "ServiceServantAssignment", "serviceId", serviceIds));
  data.set("ServiceHymnal", await selectByIds(remote, "ServiceHymnal", "serviceId", serviceIds));

  const blockIds = data.get("WorshipServiceBlock").map((row) => row.id);
  data.set("BlockPerson", await selectByIds(remote, "BlockPerson", "blockId", blockIds));

  return { data, workspaceIds };
}

async function main() {
  const email = requireArg("--email").toLowerCase();
  const apply = hasArg("--apply");
  if (apply && !hasArg("--reset-local")) throw new Error("--apply requires --reset-local because the local app tables are replaced.");

  const remoteEnv = readEnvFile(".env");
  const localEnv = readEnvFile(".env.local.docker");
  const remoteConnectionString = process.env.REMOTE_DATABASE_URL ?? remoteEnv.DIRECT_DATABASE_URL ?? remoteEnv.DATABASE_URL;
  const localConnectionString = process.env.LOCAL_DATABASE_URL ?? localEnv.DIRECT_DATABASE_URL ?? localEnv.DATABASE_URL;
  if (!remoteConnectionString || !localConnectionString) throw new Error("Both remote and local database URLs must be configured.");

  const remote = new pg.Client({ connectionString: remoteConnectionString });
  const local = new pg.Client({ connectionString: localConnectionString });
  await remote.connect();
  await local.connect();

  try {
    const localAuth = await local.query("SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) ORDER BY created_at DESC LIMIT 1", [email]);
    if (localAuth.rowCount !== 1) throw new Error(`Sign in locally as ${email} before importing so the account can be linked.`);

    const { data, workspaceIds } = await buildImportData(remote, email);
    const importedRows = [...data.values()].reduce((total, rows) => total + rows.length, 0);
    console.log(JSON.stringify({ workspaceCount: workspaceIds.length, importedRows, skippedTables: SKIPPED_TABLES }, null, 2));
    // The remote database is never modified; all writes below target the local Docker database only.
    if (!apply) return;

    await local.query("BEGIN");
    try {
      await local.query("SET LOCAL session_replication_role = replica");
      await local.query(`TRUNCATE TABLE ${APP_TABLES_TO_CLEAR.map(qualified).join(", ")} RESTART IDENTITY CASCADE`);
      for (const [table, rows] of data) await insertRows(local, table, rows);
      const mapping = await local.query(
        `UPDATE ${qualified("User")} SET "authProviderId" = $1 WHERE LOWER(email) = LOWER($2) RETURNING id`,
        [localAuth.rows[0].id, email],
      );
      if (mapping.rowCount !== 1) throw new Error(`Expected exactly one imported app user for ${email}.`);
      await local.query("COMMIT");
    } catch (error) {
      await local.query("ROLLBACK");
      throw error;
    }
  } finally {
    await Promise.allSettled([remote.end(), local.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
