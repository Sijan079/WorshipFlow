import type { BaptismStatus, PersonGender, PersonStatus } from "./person-validation.ts";

export type PersonMinistrySummary = { id: string; label: string };

export type PersonRecord = {
  id: string;
  firstName: string;
  lastName: string;
  status: PersonStatus;
  gender: PersonGender | null;
  birthdate: string | null;
  baptismStatus: BaptismStatus;
  baptismDate: string | null;
  ministries: PersonMinistrySummary[];
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
};

export type PeoplePermissions = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

export type PeopleListResponse = { items: PersonRecord[]; permissions: PeoplePermissions };
