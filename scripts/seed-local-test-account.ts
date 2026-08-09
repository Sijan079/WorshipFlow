import "dotenv/config";
import prisma from "../src/lib/prisma.ts";
import { createAdminClient } from "../src/lib/supabase/admin.ts";

const TEST_EMAIL = "yuartsijan@gmail.com";
const WORKSPACE_ID = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_NAME = "Angeles City Bible Church";
const WORKSPACE_SLUG = "angeles-city-bible-church";
const PAGINATION_MEMBERS = Array.from({ length: 6 }, (_, index) => ({
  email: `pagination.member.${String(index + 1).padStart(2, "0")}@example.com`,
  displayName: `Pagination Member ${index + 1}`,
}));
const PAGINATION_INVITATIONS = Array.from({ length: 6 }, (_, index) =>
  `pagination.invite.${String(index + 1).padStart(2, "0")}@example.com`,
);

async function ensureLocalAuthUser(email: string, displayName: string) {
  const admin = createAdminClient();
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const existing = users.users.find((user) => user.email?.toLowerCase() === email);
  if (existing) {
    if (!existing.email_confirmed_at) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
      if (error) throw error;
      return data.user;
    }
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  const authUser = await ensureLocalAuthUser(TEST_EMAIL, "Sijan");

  if (!authUser) throw new Error("Local Auth user was not created.");

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: WORKSPACE_NAME },
    create: { id: WORKSPACE_ID, name: WORKSPACE_NAME, slug: WORKSPACE_SLUG },
  });

  const user = await prisma.user.upsert({
    where: { authProviderId: authUser.id },
    update: { email: TEST_EMAIL, displayName: "Sijan" },
    create: { authProviderId: authUser.id, email: TEST_EMAIL, displayName: "Sijan" },
  });

  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { workspaceId: workspace.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
  });

  await Promise.all(PAGINATION_MEMBERS.map(async ({ email, displayName }) => {
    const memberAuthUser = await ensureLocalAuthUser(email, displayName);
    const member = await prisma.user.upsert({
      where: { authProviderId: memberAuthUser.id },
      update: { email, displayName },
      create: { authProviderId: memberAuthUser.id, email, displayName },
    });
    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: member.id } },
      update: { role: "MEMBER", status: "ACTIVE" },
      create: { workspaceId: workspace.id, userId: member.id, role: "MEMBER", status: "ACTIVE" },
    });
  }));

  await Promise.all(PAGINATION_INVITATIONS.map(async (email) => {
    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: { workspaceId: workspace.id, email, status: "PENDING" },
    });
    if (existingInvitation) return;
    await prisma.workspaceInvitation.create({
      data: {
        workspaceId: workspace.id,
        email,
        role: "MEMBER",
        invitedByUserId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }));

  console.log(JSON.stringify({ email: TEST_EMAIL, workspace: workspace.slug, role: "OWNER", paginationMembers: PAGINATION_MEMBERS.length, paginationInvitations: PAGINATION_INVITATIONS.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
