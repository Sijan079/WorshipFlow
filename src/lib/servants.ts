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

export const ServantGenderSchema = z.enum(SERVANT_GENDER_OPTIONS.map((option) => option.value) as [string, ...string[]]);
export const ServantGroupSchema = z.enum(SERVANT_GROUP_OPTIONS.map((option) => option.value) as [string, ...string[]]);

export const ServantSchema = z.object({
  name: z.string().trim().min(1, "Servant name is required"),
  gender: ServantGenderSchema,
  group: ServantGroupSchema,
});

export const UpdateServantSchema = ServantSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export function formatServantGroupLabel(group: ServantGroup) {
  return SERVANT_GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group;
}

export function formatServantGenderLabel(gender: ServantGender) {
  return SERVANT_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? gender;
}

export function formatServantDisplayName(servant: {
  name: string;
  gender: ServantGender;
  group: ServantGroup;
}) {
  const name = servant.name.trim();

  if (/^(Bro\.|Sis\.|Ptr\.)\s+/i.test(name)) {
    return name;
  }

  if (servant.group === "PASTORS") {
    return `Ptr. ${name}`;
  }

  return servant.gender === "MALE" ? `Bro. ${name}` : `Sis. ${name}`;
}
