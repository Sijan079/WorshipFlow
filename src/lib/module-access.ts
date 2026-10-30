export const CONFIGURABLE_MODULE_ACTIONS = [
  { module: "EVENTS", label: "Events", actions: [
    { action: "VIEW", label: "View calendar" },
    { action: "CREATE", label: "Create events" },
    // Needs View. Changing or cancelling a date, or the whole series, is one permission.
    { action: "EDIT", label: "Edit and cancel events" },
    // Needs View. Permanent: removes the event and all of its dates. Cancelling a date is under Edit.
    { action: "DELETE", label: "Delete events" },
  ] },
  { module: "ANNOUNCEMENTS", label: "Announcements", actions: [
    { action: "VIEW", label: "View announcements" },
    { action: "CREATE", label: "Write announcements" },
    // Needs View. Edits to a published announcement send it back to Draft unless the person can also publish.
    { action: "EDIT", label: "Edit announcements" },
    // Needs View. Only a draft can be deleted; a published one is set back to Draft first.
    { action: "DELETE", label: "Delete announcements" },
    // Needs View. Publishing, unpublishing, and the website switch.
    { action: "PUBLISH", label: "Publish announcements" },
  ] },
  { module: "SITE", label: "Church website", actions: [
    { action: "VIEW", label: "View website pages" },
    { action: "CREATE", label: "Add pages" },
    // Needs View. Edits to a live page send it back to Draft unless the person can also publish.
    { action: "EDIT", label: "Edit pages" },
    // Needs View. Only a draft can be deleted, and never the home page.
    { action: "DELETE", label: "Delete pages" },
    // Needs View. Publishing, unpublishing, and the website switch.
    { action: "PUBLISH", label: "Publish pages" },
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

export function canShowModuleNavigation(href: string, canViewEvents: boolean, canViewCaptions = false, canViewPeople = false, canViewAnnouncements = false) {
  if (href === "/events") return canViewEvents;
  if (href === "/announcements") return canViewAnnouncements;
  if (href === "/captions") return canViewCaptions;
  if (href === "/people" || href === "/ministries") return canViewPeople;
  return true;
}
