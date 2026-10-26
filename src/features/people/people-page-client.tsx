"use client";

import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2, UsersRound, X, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProductionSelect } from "@/components/ui/production-select";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import {
  MINISTRIES_QUERY_KEY,
  PEOPLE_QUERY_KEY,
  bulkUpdatePeople,
  createPerson,
  deletePerson,
  fetchMinistries,
  fetchPeople,
  updatePerson,
} from "./people-api";
import { formatBaptism, formatLongDate, formatStatusLabel, personInitials } from "./people-format";
import { PersonDialog } from "./person-dialog";
import { formToPayload, type PersonForm } from "./person-form";
import type { PersonRecord } from "./person-types";
import { PERSON_STATUSES, type PersonStatus } from "./person-validation";

const GRID = "grid-cols-[24px_40px_minmax(0,1fr)_44px] min-[1200px]:grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(110px,.6fr)_minmax(120px,.65fr)_minmax(150px,.9fr)_44px]";

const STATUS_DOT: Record<PersonStatus, string> = {
  VISITOR: "var(--state-idle)",
  REGULAR: "var(--state-ready)",
  MEMBER: "var(--state-success)",
  INACTIVE: "var(--state-idle)",
  ARCHIVED: "var(--state-idle)",
};

function StatusLabel({ status }: { status: PersonStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[status] }} />
      {formatStatusLabel(status)}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Loading people" className="divide-y divide-[var(--rule-default)]" role="status">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-panel-strong)]" />
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
        </div>
      ))}
    </div>
  );
}

export default function PeoplePageClient() {
  const queryClient = useQueryClient();
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("active");
  const [ministryId, setMinistryId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<PersonRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<PersonRecord | null>(null);
  const [addToMinistryOpen, setAddToMinistryOpen] = useState(false);
  const [bulkMinistryId, setBulkMinistryId] = useState("");

  const peopleQuery = useQuery({
    queryKey: [...PEOPLE_QUERY_KEY, { search: deferredSearch, status, ministryId }],
    queryFn: () => fetchPeople({ search: deferredSearch, status, ministryId }),
    placeholderData: keepPreviousData,
  });
  const ministriesQuery = useQuery({ queryKey: MINISTRIES_QUERY_KEY, queryFn: fetchMinistries });
  const people = peopleQuery.data?.items ?? [];
  const permissions = peopleQuery.data?.permissions ?? { canCreate: false, canEdit: false, canDelete: false };
  // Service-only ministries (Mixed) are for services, not for grouping people.
  const ministries = (ministriesQuery.data?.items ?? []).filter((ministry) => !ministry.serviceOnly);
  const activeMinistries = ministries.filter((ministry) => ministry.active);
  const filtersActive = Boolean(search.trim() || ministryId || status !== "active");

  // Resolves once the lists have reloaded, so a finished action never shows a stale list.
  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MINISTRIES_QUERY_KEY }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: ({ person, form }: { person: PersonRecord | null; form: PersonForm }) =>
      person ? updatePerson(person.id, formToPayload(form)) : createPerson(formToPayload(form)),
    onSuccess: async (_result, { person }) => {
      await refresh();
      setEditing(null);
      showToast(person ? "Changes saved." : "Person added.", "success");
    },
    onError: (error: Error) => showToast(error.message || "Could not save this person. Try again.", "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ person, next }: { person: PersonRecord; next: PersonStatus }) => updatePerson(person.id, { status: next }),
    onSuccess: async (_result, { person, next }) => {
      await refresh();
      showToast(next === "ARCHIVED" ? `${person.firstName} ${person.lastName} was archived.` : `${person.firstName} ${person.lastName} was restored as Regular.`, "success");
    },
    onError: (error: Error) => showToast(error.message || "Could not update this person.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (person: PersonRecord) => deletePerson(person.id),
    onSuccess: async (_result, person) => {
      await refresh();
      setDeleting(null);
      setSelectedIds((current) => current.filter((id) => id !== person.id));
      showToast(`${person.firstName} ${person.lastName} was permanently deleted.`, "success");
    },
    onError: (error: Error) => showToast(error.message || "Could not delete this person.", "error"),
  });

  const bulkMutation = useMutation({
    mutationFn: bulkUpdatePeople,
    onSuccess: async (result, variables) => {
      await refresh();
      setSelectedIds([]);
      setAddToMinistryOpen(false);
      showToast(variables.action === "ARCHIVE" ? `${result.count} archived.` : `Added to the ministry.`, "success");
    },
    onError: (error: Error) => showToast(error.message || "Could not update these people.", "error"),
  });

  const toggle = (id: string) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const statusOptions = [
    { value: "active", label: "Current people" },
    { value: "all", label: "Everyone, including archived" },
    ...PERSON_STATUSES.map((value) => ({ value: value as string, label: formatStatusLabel(value) })),
  ];

  return (
    <div className="people-page min-h-full space-y-6 py-1 lg:px-2">
      <section className="ui-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="ui-page-title">People</h1>
          <p className="ui-page-description">Everyone connected to your church: members, regular attendees, and visitors.</p>
        </div>
        {permissions.canCreate ? (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="ui-btn-primary pressable inline-flex min-h-11 items-center justify-center gap-2 self-start px-4 py-2.5 text-sm font-semibold sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Add person
          </button>
        ) : null}
      </section>

      <section className="ui-surface-elevated ui-operational-register">
        <div className="ui-register-toolbar">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="min-w-[220px] flex-1 sm:max-w-[280px]">
                <span className="sr-only">Search people</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name"
                    className="ui-field block min-h-10 w-full py-2 pl-10 pr-3 text-sm"
                  />
                </span>
              </label>
              <div className="min-w-[200px] flex-1 sm:max-w-[240px]">
                <ProductionSelect ariaLabel="Filter by status" value={status} onValueChange={setStatus} options={statusOptions} />
              </div>
              <div className="min-w-[180px] flex-1 sm:max-w-[220px]">
                <ProductionSelect
                  ariaLabel="Filter by ministry"
                  value={ministryId}
                  onValueChange={setMinistryId}
                  options={[{ value: "", label: "All ministries" }, ...ministries.map((ministry) => ({ value: ministry.id, label: ministry.label }))]}
                />
              </div>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("active");
                    setMinistryId("");
                  }}
                  className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 px-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--state-danger)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
              <p className="text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                {people.length} {people.length === 1 ? "person" : "people"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds([]);
                  void peopleQuery.refetch();
                }}
                className="pressable inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-accent)]"
                aria-label="Refresh people"
              >
                <RefreshCw className={`h-4 w-4 ${peopleQuery.isFetching ? "animate-spin" : ""}`} />
              </button>
              {selectedIds.length > 0 && permissions.canEdit ? (
                <>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{selectedIds.length} selected</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMinistryId(activeMinistries[0]?.id ?? "");
                      setAddToMinistryOpen(true);
                    }}
                    className="ui-btn-secondary pressable inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold"
                  >
                    <UsersRound className="h-4 w-4" />
                    Add to ministry
                  </button>
                  <button
                    type="button"
                    disabled={bulkMutation.isPending}
                    onClick={() => bulkMutation.mutate({ ids: selectedIds, action: "ARCHIVE" })}
                    className="ui-btn-secondary pressable inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold disabled:opacity-60"
                  >
                    {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    Archive
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {peopleQuery.isLoading ? (
          <ListSkeleton />
        ) : peopleQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-4 text-sm text-[var(--text-primary)]">
            <p>People could not be loaded. {peopleQuery.error instanceof Error ? peopleQuery.error.message : ""}</p>
            <button type="button" onClick={() => void peopleQuery.refetch()} className="ui-btn-secondary pressable min-h-10 px-3 text-sm font-semibold">
              Try again
            </button>
          </div>
        ) : people.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <UsersRound className="h-8 w-8 text-[var(--text-muted)]" />
            <h2 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{filtersActive ? "No one matches these filters" : "No people yet"}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              {filtersActive ? "Clear the filters to see everyone." : permissions.canCreate ? "Add your first person to start the directory." : "Ask an administrator to add people."}
            </p>
            {!filtersActive && permissions.canCreate ? (
              <button type="button" onClick={() => setEditing("new")} className="ui-btn-primary pressable mt-4 inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold">
                <Plus className="h-4 w-4" />
                Add person
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            <div aria-hidden="true" className={`ui-ledger-header hidden items-center gap-3 px-4 py-2.5 min-[1200px]:grid ${GRID}`}>
              <span />
              <span />
              <span>Name</span>
              <span>Ministries</span>
              <span>Status</span>
              <span>Birthday</span>
              <span>Baptism</span>
              <span />
            </div>
            <ul>
              {people.map((person) => {
                const fullName = `${person.firstName} ${person.lastName}`;
                const ministryText = person.ministries.map((ministry) => ministry.label).join(", ");
                return (
                  <li key={person.id} className="group ui-ledger-row" data-selected={selectedIds.includes(person.id)}>
                    <div className={`grid items-center gap-3 px-4 py-4 ${GRID}`}>
                      <label className="flex h-10 w-10 items-center justify-center justify-self-center">
                        <input type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => toggle(person.id)} aria-label={`Select ${fullName}`} className="ui-checkbox h-5 w-5" />
                      </label>
                      <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-sm font-semibold text-[var(--text-accent)]">
                        {personInitials(person.firstName, person.lastName)}
                      </span>
                      <div className="min-w-0">
                        {permissions.canEdit ? (
                          <button type="button" onClick={() => setEditing(person)} className="block max-w-full truncate text-left text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-accent)]">
                            {fullName}
                          </button>
                        ) : (
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{fullName}</p>
                        )}
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)] min-[1200px]:hidden">
                          {formatStatusLabel(person.status)}{ministryText ? ` · ${ministryText}` : ""}
                        </p>
                      </div>
                      <p className="hidden truncate text-sm text-[var(--text-secondary)] min-[1200px]:block" title={ministryText}>{ministryText || "—"}</p>
                      <div className="hidden min-[1200px]:block"><StatusLabel status={person.status} /></div>
                      <p className="hidden text-sm text-[var(--text-secondary)] min-[1200px]:block">{formatLongDate(person.birthdate)}</p>
                      <p className="hidden text-sm text-[var(--text-secondary)] min-[1200px]:block">{formatBaptism(person)}</p>
                      {permissions.canEdit || permissions.canDelete ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="ui-row-menu-trigger ui-row-menu-trigger-edge" aria-label={`Actions for ${fullName}`} title={`Actions for ${fullName}`}>
                              <MoreHorizontal className="h-5 w-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" side="left" sideOffset={8} className="workspace-content-light ui-action-menu-content w-52">
                            {permissions.canEdit ? (
                              <>
                                <DropdownMenuItem onSelect={() => setEditing(person)} className="ui-action-menu-item gap-2 px-2">
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                {person.status === "ARCHIVED" ? (
                                  <DropdownMenuItem onSelect={() => statusMutation.mutate({ person, next: "REGULAR" })} className="ui-action-menu-item gap-2 px-2">
                                    <RotateCcw className="h-4 w-4" />
                                    Restore
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => statusMutation.mutate({ person, next: "ARCHIVED" })} className="ui-action-menu-item gap-2 px-2">
                                    <Archive className="h-4 w-4" />
                                    Archive
                                  </DropdownMenuItem>
                                )}
                              </>
                            ) : null}
                            {permissions.canDelete ? (
                              <DropdownMenuItem onSelect={() => setDeleting(person)} className="ui-action-menu-item ui-action-menu-item-danger gap-2 px-2">
                                <Trash2 className="h-4 w-4" />
                                Delete permanently
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {editing ? (
        <PersonDialog
          person={editing === "new" ? null : editing}
          ministries={ministries}
          pending={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(form) => saveMutation.mutate({ person: editing === "new" ? null : editing, form })}
        />
      ) : null}

      {deleting ? (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Delete {deleting.firstName} {deleting.lastName} permanently?</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              This removes their profile, birthday, baptism details, and ministry memberships. Names already written on past services stay as plain text. This cannot be undone. To keep their history, archive them instead.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleting(null)} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleting)}
                className="ui-btn-danger pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete permanently
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {addToMinistryOpen ? (
        <Dialog open onOpenChange={(open) => !open && setAddToMinistryOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Add {selectedIds.length} to a ministry</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[var(--text-secondary)]">They stay in any ministries they already belong to.</DialogDescription>
            <div className="mt-4">
              <ProductionSelect
                label="Ministry"
                labelClassName="mb-1 block text-sm font-medium text-[var(--text-secondary)]"
                value={bulkMinistryId}
                onValueChange={setBulkMinistryId}
                options={activeMinistries.map((ministry) => ({ value: ministry.id, label: ministry.label }))}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setAddToMinistryOpen(false)} className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold">Cancel</button>
              <button
                type="button"
                disabled={!bulkMinistryId || bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: selectedIds, action: "ADD_TO_MINISTRY", ministryId: bulkMinistryId })}
                className="ui-btn-primary pressable inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
              >
                {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add to ministry
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <PAPToastViewport toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}
