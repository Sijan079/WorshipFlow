import { CreatePersonSchema, type BaptismStatus, type PersonGender, type PersonStatus } from "./person-validation.ts";
import type { PersonRecord } from "./person-types.ts";

export type DateParts = { year: string; month: string; day: string };

export type PersonForm = {
  firstName: string;
  lastName: string;
  status: PersonStatus;
  gender: PersonGender | "";
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  baptismStatus: BaptismStatus;
  baptismYear: string;
  baptismMonth: string;
  baptismDay: string;
  ministryIds: string[];
};

export type PersonFormErrors = Partial<Record<"firstName" | "lastName" | "birthdate" | "baptismDate" | "ministryIds", string>>;

export type PersonPayload = {
  firstName: string;
  lastName: string;
  status: PersonStatus;
  gender: PersonGender | null;
  birthdate: string | null;
  baptismStatus: BaptismStatus;
  baptismDate: string | null;
  ministryIds: string[];
};

const INCOMPLETE_DATE_MESSAGE = "Choose a month, day, and year.";

export function datePartsToIso(parts: DateParts): string | null | "incomplete" {
  const filled = [parts.year, parts.month, parts.day].filter(Boolean).length;
  if (filled === 0) return null;
  if (filled < 3) return "incomplete";
  return `${parts.year.padStart(4, "0")}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
}

export function isoToDateParts(iso: string | null): DateParts {
  if (!iso) return { year: "", month: "", day: "" };
  const [year, month, day] = iso.split("-");
  return { year, month: String(Number(month)), day: String(Number(day)) };
}

export function emptyPersonForm(): PersonForm {
  return {
    firstName: "",
    lastName: "",
    status: "REGULAR",
    gender: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    baptismStatus: "UNKNOWN",
    baptismYear: "",
    baptismMonth: "",
    baptismDay: "",
    ministryIds: [],
  };
}

export function personToForm(person: PersonRecord): PersonForm {
  const birth = isoToDateParts(person.birthdate);
  const baptism = isoToDateParts(person.baptismDate);
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    status: person.status,
    gender: person.gender ?? "",
    birthYear: birth.year,
    birthMonth: birth.month,
    birthDay: birth.day,
    baptismStatus: person.baptismStatus,
    baptismYear: baptism.year,
    baptismMonth: baptism.month,
    baptismDay: baptism.day,
    ministryIds: person.ministries.map((ministry) => ministry.id),
  };
}

function formDates(form: PersonForm) {
  const birthdate = datePartsToIso({ year: form.birthYear, month: form.birthMonth, day: form.birthDay });
  const baptismDate = form.baptismStatus === "BAPTIZED"
    ? datePartsToIso({ year: form.baptismYear, month: form.baptismMonth, day: form.baptismDay })
    : null;
  return { birthdate, baptismDate };
}

export function formToPayload(form: PersonForm): PersonPayload {
  const { birthdate, baptismDate } = formDates(form);
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    status: form.status,
    gender: form.gender || null,
    birthdate: birthdate === "incomplete" ? null : birthdate,
    baptismStatus: form.baptismStatus,
    baptismDate: baptismDate === "incomplete" ? null : baptismDate,
    ministryIds: form.ministryIds,
  };
}

// Validates with the same shared rules as the server and returns plain,
// field-level messages, or null when the form can be saved.
export function validatePersonForm(form: PersonForm): PersonFormErrors | null {
  const errors: PersonFormErrors = {};
  const { birthdate, baptismDate } = formDates(form);
  if (birthdate === "incomplete") errors.birthdate = INCOMPLETE_DATE_MESSAGE;
  if (baptismDate === "incomplete") errors.baptismDate = INCOMPLETE_DATE_MESSAGE;

  const parsed = CreatePersonSchema.safeParse(formToPayload(form));
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    for (const key of ["firstName", "lastName", "birthdate", "baptismDate", "ministryIds"] as const) {
      const message = fieldErrors[key]?.[0];
      if (message && !errors[key]) errors[key] = message;
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
