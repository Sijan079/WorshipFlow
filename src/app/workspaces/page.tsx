import { redirect } from "next/navigation";
import WorkspaceSelectionClient from "@/components/workspace-selection-client";
import { listUserWorkspaces } from "@/lib/security-context";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const workspaces = await listUserWorkspaces();

  if (workspaces.length === 1) {
    redirect(`/w/${encodeURIComponent(workspaces[0].slug)}/dashboard`);
  }

  return <WorkspaceSelectionClient workspaces={workspaces} />;
}
