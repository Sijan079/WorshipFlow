export const DEFAULT_WORKSPACE_SLUG = "default";

type WorkspaceEnvironment = {
  WORSHIP_WORKSPACE_SLUG?: string;
};

export function getDefaultWorkspaceSlug(env: WorkspaceEnvironment = process.env as WorkspaceEnvironment) {
  const slug = env.WORSHIP_WORKSPACE_SLUG?.trim();
  return slug || DEFAULT_WORKSPACE_SLUG;
}
