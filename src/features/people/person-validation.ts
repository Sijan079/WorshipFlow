import { z } from "zod";

export const PERSON_STATUSES = ["VISITOR", "REGULAR", "MEMBER", "INACTIVE", "ARCHIVED"] as const;
export const BAPTISM_STATUSES = ["BAPTIZED", "NOT_BAPTIZED", "UNKNOWN"] as const;
export const PERSON_GENDERS = ["MALE", "FEMALE"] as const;

export type PersonStatus = (typeof PERSON_STATUSES)[number];
export type BaptismStatus = (typeof BAPTISM_STATUSES)[number];
export type PersonGender = (typeof PERSON_GENDERS)[number];

const MIN_YEAR = 1900;

function isPlausibleDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return date.getUTCFullYear() >= MIN_YEAR && date.getTime() <= Date.now();
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine(isPlausibleDate, "Enter a real date that is not in the future.");

const personName = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(80, `${label} is too long.`);

const ministryIds = z
  .array(z.uuid())
  .max(30)
  .transform((ids) => Array.from(new Set(ids)));

const fields = {
  firstName: personName("First name"),
  lastName: personName("Last name"),
  status: z.enum(PERSON_STATUSES),
  gender: z.enum(PERSON_GENDERS).nullable(),
  birthdate: dateOnly.nullable(),
  baptismStatus: z.enum(BAPTISM_STATUSES),
  baptismDate: dateOnly.nullable(),
  ministryIds,
};

export const CreatePersonSchema = z
  .object({
    firstName: fields.firstName,
    lastName: fields.lastName,
    status: fields.status.default("REGULAR"),
    gender: fields.gender.optional(),
    birthdate: fields.birthdate.optional(),
    baptismStatus: fields.baptismStatus.default("UNKNOWN"),
    baptismDate: fields.baptismDate.optional(),
    ministryIds: fields.ministryIds.default([]),
  })
  .superRefine((value, context) => {
    if (value.baptismDate && value.baptismStatus !== "BAPTIZED") {
      context.addIssue({ code: "custom", path: ["baptismDate"], message: "A baptism date needs a Baptized status." });
    }
  });

export const UpdatePersonSchema = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;
export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

type BaptismResult =
  | { ok: true; baptismStatus: BaptismStatus; baptismDate: string | null | undefined }
  | { ok: false; error: string };

// Applies a partial change to a person's baptism fields. The date exists only for
// Baptized people; leaving Baptized clears it. `baptismDate: undefined` means unchanged.
export function resolveBaptism(
  currentStatus: BaptismStatus,
  patch: { baptismStatus?: BaptismStatus; baptismDate?: string | null },
): BaptismResult {
  const statusChanged = patch.baptismStatus !== undefined;
  const baptismStatus = patch.baptismStatus ?? currentStatus;

  if (baptismStatus !== "BAPTIZED") {
    if (patch.baptismDate) return { ok: false, error: "A baptism date needs a Baptized status." };
    return { ok: true, baptismStatus, baptismDate: statusChanged ? null : patch.baptismDate };
  }
  return { ok: true, baptismStatus, baptismDate: patch.baptismDate };
}

export function formatPersonName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

export function comparePeople(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string },
) {
  const options = { sensitivity: "base" } as const;
  return a.lastName.localeCompare(b.lastName, undefined, options) || a.firstName.localeCompare(b.firstName, undefined, options);
}
