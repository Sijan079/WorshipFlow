// Default Ministries for a new workspace. One list replaces the old service
// ministries (AssignedMinistry) and the servant groups (ServantGroup).

export const DEFAULT_MINISTRIES = [
  { code: "CHURCH_LEADERS", label: "Church Leaders" },
  { code: "PASTORS", label: "Pastors" },
  { code: "MENS", label: "Men's" },
  { code: "LADIES", label: "Ladies'" },
  { code: "YOUTH", label: "Youth" },
  { code: "TECH", label: "Tech" },
  { code: "MUSIC", label: "Music" },
  { code: "MIXED", label: "Mixed" },
] as const;

export type MinistryCode = (typeof DEFAULT_MINISTRIES)[number]["code"];

// Services called the leaders group LEADERS; the roster called it CHURCH_LEADERS.
const LEGACY_CODE_ALIASES: Record<string, string> = { LEADERS: "CHURCH_LEADERS" };

export function ministryCodeFromLegacy(code: string) {
  return LEGACY_CODE_ALIASES[code] ?? code;
}
