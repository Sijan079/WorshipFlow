export const WORKSPACE_MODULES = ["services", "songs", "media-tools", "automation"] as const;

export type WorkspaceModule = (typeof WORKSPACE_MODULES)[number];

export const MEDIA_TOOLS_MODULE = "media-tools" as const;
