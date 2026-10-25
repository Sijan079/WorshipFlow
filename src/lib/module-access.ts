export const CONFIGURABLE_MODULE_ACTIONS = [
  { module: "EVENTS", label: "Events", actions: [
    { action: "VIEW", label: "View calendar" },
    { action: "CREATE", label: "Create events" },
  ] },
  { module: "CAPTIONS", label: "Sermon Captions", actions: [
    { action: "VIEW", label: "View captions" },
    { action: "OPERATE", label: "Operate live captions" },
  ] },
] as const;

export function isConfigurableModuleAction(module: string, action: string) {
  return CONFIGURABLE_MODULE_ACTIONS.some((entry) =>
    entry.module === module && entry.actions.some((item) => item.action === action));
}

export function resolveModuleAction(role: string, defaultEnabled: boolean, personalOverride: boolean | null) {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "MEMBER") return false;
  return personalOverride ?? defaultEnabled;
}

export function canShowModuleNavigation(href: string, canViewEvents: boolean, canViewCaptions = false) {
  if (href === "/events") return canViewEvents;
  if (href === "/captions") return canViewCaptions;
  return true;
}
