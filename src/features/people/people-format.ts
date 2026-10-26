import type { PersonRecord } from "./person-types.ts";
import type { PersonStatus } from "./person-validation.ts";

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

// One plain line per status, shown under the Status menu so nobody has to guess.
export const STATUS_DESCRIPTIONS: Record<PersonStatus, string> = {
  VISITOR: "A guest who is visiting.",
  REGULAR: "Attends often but has not formally joined the church.",
  MEMBER: "Has formally joined the church.",
  INACTIVE: "Used to attend but is no longer active.",
  ARCHIVED: "Moved away or no longer part of the church. Hidden from the main list.",
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
