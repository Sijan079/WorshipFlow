export const CONFIGURABLE_MODULE_ACTIONS = [
  { module: "EVENTS", label: "Events", actions: [
    { action: "VIEW", label: "View calendar" },
    { action: "CREATE", label: "Create events" },
    // Needs View. Changing or cancelling a date, or the whole series, is one permission.
    { action: "EDIT", label: "Edit and cancel events" },
    // Needs View. Permanent: removes the event and all of its dates. Cancelling a date is under Edit.
    { action: "DELETE", label: "Delete events" },
  ] },
  { module: "CAPTIONS", label: "Sermon Captions", actions: [
    { action: "VIEW", label: "View captions" },
    { action: "OPERATE", label: "Operate live captions" },
    // Needs View. Regenerating the link is never listed: only Owner and Admin can do it.
    { action: "SHARE", label: "Share captions link" },
  ] },
  // Hard delete is not listed: only Owner and Admin can permanently delete a person.
  { module: "PEOPLE", label: "People and ministries", actions: [
    { action: "VIEW", label: "View people" },
    { action: "CREATE", label: "Add people" },
    { action: "EDIT", label: "Edit and archive people" },
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

export function canShowModuleNavigation(href: string, canViewEvents: boolean, canViewCaptions = false, canViewPeople = false) {
  if (href === "/events") return canViewEvents;
  if (href === "/captions") return canViewCaptions;
  if (href === "/people" || href === "/ministries") return canViewPeople;
  return true;
}
