import { apiFetch } from "@/lib/api-client";
import type { MinistryListResponse, MinistryRecord } from "@/features/ministries/ministry-types";
import type { PeopleListResponse, PersonRecord } from "./person-types";
import type { PersonPayload } from "./person-form";

export type PeopleFilters = { search: string; status: string; ministryId: string };

export type PersonNameRecord = { id: string; name: string };
export type MinistryOptionRecord = { id: string; code: string; label: string; serviceOnly: boolean };

export const PEOPLE_QUERY_KEY = ["people"] as const;
export const MINISTRIES_QUERY_KEY = ["ministries"] as const;

export function fetchPeople(filters: PeopleFilters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.ministryId) params.set("ministryId", filters.ministryId);
  const query = params.toString();
  return apiFetch<PeopleListResponse>(`/api/people${query ? `?${query}` : ""}`);
}

export function fetchMinistries() {
  return apiFetch<MinistryListResponse>("/api/ministries");
}

export function createPerson(payload: PersonPayload) {
  return apiFetch<PersonRecord>("/api/people", { method: "POST", body: JSON.stringify(payload) });
}

export function updatePerson(id: string, payload: Partial<PersonPayload>) {
  return apiFetch<PersonRecord>(`/api/people/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deletePerson(id: string) {
  return apiFetch<{ success: true }>(`/api/people/${id}`, { method: "DELETE" });
}

export function bulkUpdatePeople(body: { ids: string[]; action: "ARCHIVE" | "ADD_TO_MINISTRY"; ministryId?: string }) {
  return apiFetch<{ count: number }>("/api/people/bulk", { method: "POST", body: JSON.stringify(body) });
}

export function createMinistry(label: string) {
  return apiFetch<MinistryRecord>("/api/ministries", { method: "POST", body: JSON.stringify({ label }) });
}

export function updateMinistry(id: string, patch: { label?: string; active?: boolean; leaderId?: string | null }) {
  return apiFetch<MinistryRecord>(`/api/ministries/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

// Names only, for choosing someone on a service. Open to any member of the workspace.
export function fetchPeopleNames() {
  return apiFetch<PersonNameRecord[]>("/api/people/names");
}

// Ministry choices for a service. Open to any member of the workspace.
export function fetchMinistryOptions() {
  return apiFetch<MinistryOptionRecord[]>("/api/ministries/options");
}
