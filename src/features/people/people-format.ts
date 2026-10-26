import type { PersonRecord } from "./person-types.ts";
import type { PersonGender, PersonStatus } from "./person-validation.ts";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const STATUS_LABELS: Record<PersonStatus, string> = {
  VISITOR: "Visitor",
  REGULAR: "Regular",
  MEMBER: "Member",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export function formatStatusLabel(status: PersonStatus) {
  return STATUS_LABELS[status];
}

// "1952-03-04" becomes "Mar 4, 1952". Parsed by hand so the time zone never shifts the day.
export function formatLongDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}, ${year}`;
}

export function formatBaptism(person: Pick<PersonRecord, "baptismStatus" | "baptismDate">) {
  if (person.baptismStatus === "BAPTIZED") {
    return person.baptismDate ? `Baptized · ${formatLongDate(person.baptismDate)}` : "Baptized";
  }
  if (person.baptismStatus === "NOT_BAPTIZED") return "Not baptized";
  return "—";
}

export function personInitials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

// How a person's name reads in a service: Ptr. for pastors, otherwise Bro. or Sis. by gender.
// Matches the convention the old servant roster used.
export function formatPersonDisplayName(person: {
  firstName: string;
  lastName: string;
  gender: PersonGender | null;
  ministryCodes: readonly string[];
}) {
  const name = `${person.firstName} ${person.lastName}`.trim();
  if (person.ministryCodes.includes("PASTORS")) return `Ptr. ${name}`;
  if (person.gender === "MALE") return `Bro. ${name}`;
  if (person.gender === "FEMALE") return `Sis. ${name}`;
  return name;
}
