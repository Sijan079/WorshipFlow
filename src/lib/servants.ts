import { z } from "zod";

export const SERVANT_GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export const SERVANT_GROUP_OPTIONS = [
  { value: "PASTORS", label: "Pastors" },
  { value: "CHURCH_LEADERS", label: "Church Leaders" },
  { value: "MENS", label: "Men's" },
  { value: "LADIES", label: "Ladies'" },
  { value: "YOUTH", label: "Youth" },
  { value: "TECH", label: "Tech" },
  { value: "MUSIC", label: "Music" },
] as const;

export type ServantGender = (typeof SERVANT_GENDER_OPTIONS)[number]["value"];
export type ServantGroup = (typeof SERVANT_GROUP_OPTIONS)[number]["value"];
export type NullableServantGender = ServantGender | null;
export type NullableServantGroup = ServantGroup | null;

export const ServantGenderSchema = z.enum(SERVANT_GENDER_OPTIONS.map((option) => option.value) as [string, ...string[]]);
export const ServantGroupSchema = z.enum(SERVANT_GROUP_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const ServantGroupCodeSchema = z
  .string()
  .trim()
  .min(1, "Group code is required")
  .max(48, "Group code is too long")
  .regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase letters, numbers, and underscores");

export const ServantSchema = z.object({
  name: z.string().trim().min(1, "Servant name is required"),
  gender: ServantGenderSchema.nullable().optional(),
  group: ServantGroupSchema.nullable().optional(),
  groupCode: ServantGroupCodeSchema.nullable().optional(),
});

export const UpdateServantSchema = ServantSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export function formatServantGroupLabel(group: NullableServantGroup) {
  if (!group) {
    return "Not set";
  }

  return SERVANT_GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group;
}

export function formatServantGenderLabel(gender: NullableServantGender) {
  if (!gender) {
    return "Not set";
  }

  return SERVANT_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? gender;
}

export function normalizeServantName(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/^(Bro\.|Sis\.|Ptr\.)\s+/i, "").trim();
}

export function normalizeServantNameForComparison(value: string) {
  return normalizeServantName(value).toLocaleLowerCase();
}

export function getServantInitials(value: string) {
  const parts = normalizeServantName(value).split(/\s+/).filter(Boolean);
  const suffix = /^(?:Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$/i;

  while (parts.length > 1 && suffix.test(parts[parts.length - 1])) {
    parts.pop();
  }

  if (parts.length === 0) {
    return "?";
  }

  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

export function formatServantDisplayName(servant: {
  name: string;
  gender: NullableServantGender;
  group: NullableServantGroup;
}) {
  const name = servant.name.trim();

  if (/^(Bro\.|Sis\.|Ptr\.)\s+/i.test(name)) {
    return name;
  }

  if (servant.group === "PASTORS") {
    return `Ptr. ${name}`;
  }

  if (servant.gender === "MALE") {
    return `Bro. ${name}`;
  }

  if (servant.gender === "FEMALE") {
    return `Sis. ${name}`;
  }

  return name;
}
