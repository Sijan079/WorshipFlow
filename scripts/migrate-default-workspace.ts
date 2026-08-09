import "dotenv/config";
import prisma from "../src/lib/prisma.ts";
import { seedChecklistPresets, seedMinistryPresets, seedServiceTemplatePresets, seedServantGroupPresets } from "../src/lib/settings-server.ts";

const TARGET_NAME = "Angeles City Bible Church";
const TARGET_SLUG = "angeles-city-bible-church";

function readArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing --${name}.`);
  return value.trim();
}

async function main() {
  const ownerEmail = readArg("owner-email").toLowerCase();
  const apply = process.argv.includes("--apply");
  const source = await prisma.workspace.findUnique({ where: { slug: "default" }, select: { id: true, name: true, slug: true } });
  const target = await prisma.workspace.findUnique({ where: { slug: TARGET_SLUG }, select: { id: true, name: true, slug: true } });

  if (source && target && source.id !== target.id) {
    throw new Error(`Both default and ${TARGET_SLUG} workspaces exist; refusing to merge them automatically.`);
  }

  const workspace = source ?? target;
  if (!workspace) throw new Error("No default workspace exists to migrate.");

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true, email: true } });
  if (!owner) throw new Error("Owner account was not found. Sign in once first, then rerun with that email.");

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", workspaceId: workspace.id, from: workspace.slug, to: TARGET_SLUG, ownerEmail }, null, 2));
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    const migrated = await tx.workspace.update({
      where: { id: workspace.id },
      data: { name: TARGET_NAME, slug: TARGET_SLUG },
    });

    await tx.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: migrated.id, userId: owner.id } },
      update: { role: "OWNER", status: "ACTIVE" },
      create: { workspaceId: migrated.id, userId: owner.id, role: "OWNER", status: "ACTIVE" },
    });

    await seedMinistryPresets(tx, migrated.id);
    await seedServantGroupPresets(tx, migrated.id);
    await seedChecklistPresets(tx, migrated.id);
    await seedServiceTemplatePresets(tx, migrated.id);
  });

  console.log(`Migrated workspace to ${TARGET_NAME} (${TARGET_SLUG}) and assigned ${ownerEmail} as OWNER.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
