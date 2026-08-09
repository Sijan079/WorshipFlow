import "dotenv/config";
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.ts";
import { createAdminClient } from "../src/lib/supabase/admin.ts";

function readArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value?.trim()) throw new Error(`Missing --${name}.`);
  return value.trim();
}

async function main() {
  const name = readArg("name");
  const slug = readArg("slug").toLowerCase();
  const ownerEmail = readArg("owner-email").toLowerCase();
  const workspace = await prisma.workspace.upsert({
    where: { slug },
    update: { name },
    create: { id: randomUUID(), slug, name },
  });

  const invitation = await prisma.workspaceInvitation.upsert({
    where: { id: `${workspace.id}:owner:${ownerEmail}` },
    update: {
      email: ownerEmail,
      role: "OWNER",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: `${workspace.id}:owner:${ownerEmail}`,
      workspaceId: workspace.id,
      email: ownerEmail,
      role: "OWNER",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const admin = createAdminClient();
  const origin = process.env.APP_URL || "http://localhost:3000";
  const { error } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
    redirectTo: `${origin}/auth/callback?invitationId=${invitation.id}&workspace=${encodeURIComponent(slug)}`,
  });
  if (error) throw error;

  console.log(JSON.stringify({ workspaceId: workspace.id, slug: workspace.slug, ownerEmail }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
