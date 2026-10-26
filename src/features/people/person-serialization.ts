import type { PersonMinistrySummary, PersonRecord } from "./person-types";
import type { BaptismStatus, PersonGender, PersonStatus } from "./person-validation";

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: PersonStatus;
  gender: PersonGender | null;
  birthdate: Date | null;
  baptismStatus: BaptismStatus;
  baptismDate: Date | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  ministries: Array<{ ministry: PersonMinistrySummary }>;
};

function dateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function serializePerson(row: PersonRow, userNames: Map<string, string>): PersonRecord {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    gender: row.gender,
    birthdate: dateOnly(row.birthdate),
    baptismStatus: row.baptismStatus,
    baptismDate: dateOnly(row.baptismDate),
    ministries: row.ministries
      .map((link) => ({ id: link.ministry.id, label: link.ministry.label }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByName: row.createdByUserId ? userNames.get(row.createdByUserId) ?? null : null,
    updatedByName: row.updatedByUserId ? userNames.get(row.updatedByUserId) ?? null : null,
  };
}

// Dates arrive as YYYY-MM-DD and are stored as date-only values (UTC midnight).
export function parseDateOnly(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
