export const ASSIGNED_MINISTRY_OPTIONS = [
  { value: "LEADERS", label: "Leaders'" },
  { value: "YOUTH", label: "Youth" },
  { value: "MENS", label: "Mens'" },
  { value: "LADIES", label: "Ladies'" },
  { value: "MIXED", label: "Mixed" },
] as const;

export const SERVICE_TEMPLATE_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "FIRST_SUNDAY", label: "1st Sunday" },
] as const;

export const PLEDGE_TYPE_OPTIONS = [
  { value: "PLEDGE_OF_FAITH", label: "Pledge of Faith" },
  { value: "COVENANT", label: "Covenant" },
] as const;

export const SERVICE_SERVANT_ROLES = [
  { value: "CALL_TO_WORSHIP", label: "Call To Worship" },
  { value: "EMCEE", label: "Emcee" },
  { value: "SCRIPTURE_READER", label: "Scripture Reader" },
  { value: "SERMON_SPEAKER", label: "Sermon Speaker" },
  { value: "OFFERING", label: "Offering" },
  { value: "PLEDGE_READER", label: "Pledge Reader", firstSundayOnly: true },
] as const;

export const SERVICE_HYMNAL_ROLES = [
  { value: "HYMN_OF_PREPARATION", label: "Hymn of Preparation" },
  { value: "HYMN_OF_RESPONSE", label: "Hymn of Response" },
  { value: "SONG_OF_HYMNS", label: "Song of Hymns", firstSundayOnly: true },
] as const;

export type AssignedMinistry = (typeof ASSIGNED_MINISTRY_OPTIONS)[number]["value"];
export type ServiceTemplateType = (typeof SERVICE_TEMPLATE_OPTIONS)[number]["value"];
export type PledgeType = (typeof PLEDGE_TYPE_OPTIONS)[number]["value"];
export type ServiceServantRole = (typeof SERVICE_SERVANT_ROLES)[number]["value"];
export type ServiceHymnalRole = (typeof SERVICE_HYMNAL_ROLES)[number]["value"];

export function buildBibleGatewayUrl(verse: string) {
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(verse.trim())}&version=MBBTAG`;
}

export function getDefaultNextServiceSunday(baseDate = new Date()) {
  const utcDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
  const currentDay = utcDate.getUTCDay();
  const daysUntilNextSunday = currentDay === 0 ? 7 : 14 - currentDay;
  utcDate.setUTCDate(utcDate.getUTCDate() + daysUntilNextSunday);
  return utcDate;
}

export function mapTemplateTypeToServiceVariant(templateType: ServiceTemplateType) {
  return templateType === "FIRST_SUNDAY" ? "EXTENDED" : "STANDARD";
}

export function mapAssignedMinistryToLegacyMinistryName(assignedMinistry: AssignedMinistry) {
  return ASSIGNED_MINISTRY_OPTIONS.find((option) => option.value === assignedMinistry)?.label ?? "Mixed";
}

export function inferAssignedMinistryFromName(ministryName?: string | null): AssignedMinistry {
  const value = ministryName?.trim().toLowerCase();
  if (!value) return "MIXED";
  if (value.includes("leader")) return "LEADERS";
  if (value.includes("youth") || value.includes("young people")) return "YOUTH";
  if (value.includes("men")) return "MENS";
  if (value.includes("ladies")) return "LADIES";
  if (value.includes("mixed")) return "MIXED";
  return "MIXED";
}

export function formatOfferingPeople(people: string[]) {
  return people.map((person) => person.trim()).filter(Boolean).join(" & ");
}

export function parseOfferingPeople(value?: string | null): [string, string] {
  const people = value
    ? value.split(/\s*&\s*/).map((person) => person.trim()).filter(Boolean)
    : [];
  return [people[0] ?? "", people[1] ?? ""];
}

export function sortServicesBySoonest<T extends { serviceDate: string }>(services: T[]) {
  return [...services].sort(
    (left, right) => new Date(left.serviceDate).getTime() - new Date(right.serviceDate).getTime()
  );
}
