// Default Ministries for a new workspace. One list replaces the old service
// ministries (AssignedMinistry) and the servant groups (ServantGroup).

export const DEFAULT_MINISTRIES = [
  { code: "CHURCH_LEADERS", label: "Church Leaders", serviceOnly: false },
  { code: "PASTORS", label: "Pastors", serviceOnly: false },
  { code: "MENS", label: "Men's", serviceOnly: false },
  { code: "LADIES", label: "Ladies'", serviceOnly: false },
  { code: "YOUTH", label: "Youth", serviceOnly: false },
  { code: "TECH", label: "Tech", serviceOnly: false },
  { code: "MUSIC", label: "Music", serviceOnly: false },
  // Not a group of people: how a 5th Sunday service is run, by a mixed team.
  { code: "MIXED", label: "Mixed team (5th Sunday)", serviceOnly: true },
] as const;

export type MinistryCode = (typeof DEFAULT_MINISTRIES)[number]["code"];

// Services called the leaders group LEADERS; the roster called it CHURCH_LEADERS.
const LEGACY_CODE_ALIASES: Record<string, string> = { LEADERS: "CHURCH_LEADERS" };

export function ministryCodeFromLegacy(code: string) {
  return LEGACY_CODE_ALIASES[code] ?? code;
}
