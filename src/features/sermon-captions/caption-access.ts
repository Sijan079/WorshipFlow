import { requireExplicitWorkspaceRole, WorkspaceAuthorizationError } from "@/lib/security-context";
import { hasModuleAction } from "@/lib/event-access";

export async function requireCaptionAction(action: "VIEW" | "OPERATE") {
  const context = await requireExplicitWorkspaceRole("MEMBER");
  const [canView, canOperate] = await Promise.all([
    hasModuleAction(context, "CAPTIONS", "VIEW"),
    action === "OPERATE" ? hasModuleAction(context, "CAPTIONS", "OPERATE") : Promise.resolve(true),
  ]);
  if (!canView || !canOperate) {
    throw new WorkspaceAuthorizationError(403, `You do not have permission to ${action === "VIEW" ? "view" : "operate"} Sermon Captions.`);
  }
  return context;
}
