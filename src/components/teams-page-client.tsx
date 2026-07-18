"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCcw, Search, Settings2, Trash2, UsersRound, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  type CreateServantPayload,
  type EditableSettingsPresetRecord,
  type ServantRecord,
  type UpdateServantPayload,
} from "@/lib/api-client";
import {
  formatServantGenderLabel,
  formatServantGroupLabel,
  getServantInitials,
  SERVANT_GENDER_OPTIONS,
  SERVANT_GROUP_OPTIONS,
  type NullableServantGender,
  type ServantGender,
  type ServantGroup,
} from "@/lib/servants";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProductionSelect } from "@/components/ui/production-select";

type ServantFormState = CreateServantPayload;
type ServantFormErrors = Partial<Record<keyof ServantFormState, string>>;
type BulkAssignFormState = {
  gender: ServantGender | "" | "null";
  groupCode: string | "";
};

type GroupOption = {
  value: string;
  label: string;
  legacyGroup: ServantGroup | null;
};

const EMPTY_FORM: ServantFormState = {
  name: "",
  gender: null,
  group: null,
  groupCode: null,
};

function buildGroupOptions(records: EditableSettingsPresetRecord[] = []): GroupOption[] {
  if (records.length > 0) {
    return records.filter((record) => record.active).map((record) => ({
      value: record.code,
      label: record.label,
      legacyGroup: SERVANT_GROUP_OPTIONS.some((option) => option.value === record.code)
        ? (record.code as ServantGroup)
        : null,
    }));
  }

  return SERVANT_GROUP_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    legacyGroup: option.value,
  }));
}

function getGroupLabel(servant: ServantRecord, groupOptions: GroupOption[]) {
  return groupOptions.find((option) => option.value === servant.groupCode)?.label
    ?? formatServantGroupLabel(servant.group);
}

function validateServantForm(form: ServantFormState): ServantFormErrors {
  const errors: ServantFormErrors = {};

  if (!form.name.trim()) {
    errors.name = "Servant name is required";
  }

  return errors;
}

function TeamsListSkeleton() {
  return (
    <div aria-label="Loading team roster" className="divide-y divide-[var(--rule-default)]" role="status">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`team-skeleton-${index}`}
          className="grid grid-cols-[24px_40px_minmax(0,1fr)_44px] items-center gap-3 px-4 py-4 lg:grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(120px,.6fr)_minmax(140px,.75fr)_44px]"
        >
          <div className="h-5 w-5 animate-pulse rounded-[var(--radius-xs)] bg-[var(--surface-panel-strong)]" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-panel-strong)]" />
          <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-panel-strong)]" />
          <div className="hidden h-5 w-20 animate-pulse rounded bg-[var(--surface-panel-strong)] lg:block" />
          <div className="hidden h-7 w-28 animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-panel-strong)] lg:block" />
          <div className="h-10 w-10 animate-pulse rounded-md bg-[var(--surface-panel-strong)]" />
        </div>
      ))}
    </div>
  );
}

function BulkAssignModal({
  form,
  groupOptions,
  onApply,
  onChange,
  onClose,
  pending,
  selectedCount,
}: {
  form: BulkAssignFormState;
  groupOptions: GroupOption[];
  onApply: () => void;
  onChange: (next: BulkAssignFormState) => void;
  onClose: () => void;
  pending: boolean;
  selectedCount: number;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="technical-label">BULK ASSIGN</p>
            <DialogTitle className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              Update {selectedCount} servant{selectedCount === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              Leave a field untouched if you do not want to change it for the selected rows.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
            aria-label="Close bulk assign modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ProductionSelect
            label="Gender"
            value={form.gender}
            onValueChange={(value) => onChange({ ...form, gender: value as BulkAssignFormState["gender"] })}
            options={[
              { value: "", label: "Leave unchanged" },
              { value: "null", label: "Set to Not set" },
              ...SERVANT_GENDER_OPTIONS,
            ]}
          />

          <ProductionSelect
            label="Group"
            value={form.groupCode}
            onValueChange={(value) => onChange({ ...form, groupCode: value })}
            options={[
              { value: "", label: "Leave unchanged" },
              { value: "null", label: "Set to Not set" },
              ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
            ]}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onApply}
            disabled={pending}
            className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            Apply changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServantModal({
  errors,
  form,
  groupOptions,
  onChange,
  onClose,
  onSubmit,
  pending,
  servant,
}: {
  errors: ServantFormErrors;
  form: ServantFormState;
  groupOptions: GroupOption[];
  onChange: (next: ServantFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  servant: ServantRecord | null;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="technical-label">{servant ? "EDIT SERVANT" : "ADD SERVANT"}</p>
            <DialogTitle className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {servant ? form.name || "Edit servant" : "Create servant"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
              Keep the profile lightweight for service assignment and filtering.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] text-[var(--text-secondary)]"
            aria-label="Close servant modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm text-[var(--text-secondary)]">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
            {errors.name ? <p className="mt-1 text-xs text-[var(--state-danger)]">{errors.name}</p> : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <ProductionSelect
              label="Gender"
              value={form.gender ?? ""}
              onValueChange={(value) => onChange({ ...form, gender: (value || null) as NullableServantGender })}
              options={[{ value: "", label: "Not set" }, ...SERVANT_GENDER_OPTIONS]}
            />

            <ProductionSelect
              label="Group"
              value={form.groupCode ?? form.group ?? ""}
              onValueChange={(value) => {
                  const option = groupOptions.find((item) => item.value === value);
                  onChange({
                    ...form,
                    group: option?.legacyGroup ?? null,
                    groupCode: value || null,
                  });
                }}
              options={[
                { value: "", label: "Not set" },
                ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
              ]}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="pressable inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {servant ? "Save changes" : "Create servant"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsPageClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedServantIds, setSelectedServantIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [editingServant, setEditingServant] = useState<ServantRecord | null>(null);
  const [form, setForm] = useState<ServantFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ServantFormErrors>({});
  const [bulkAssignForm, setBulkAssignForm] = useState<BulkAssignFormState>({ gender: "", groupCode: "" });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (groupFilter) params.set("group", groupFilter);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [deferredSearch, groupFilter]);

  const servantsQuery = useQuery({
    queryKey: ["servants", queryString],
    queryFn: () => apiFetch<ServantRecord[]>(`/api/servants${queryString}`),
  });
  const servantGroupsQuery = useQuery({
    queryKey: ["settings", "servant-groups"],
    queryFn: () => apiFetch<EditableSettingsPresetRecord[]>("/api/settings/servant-groups"),
    staleTime: 30_000,
  });
  const groupOptions = useMemo(() => buildGroupOptions(servantGroupsQuery.data), [servantGroupsQuery.data]);

  const createServantMutation = useMutation({
    mutationFn: (payload: CreateServantPayload) =>
      apiFetch<ServantRecord>("/api/servants", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      closeModal();
    },
  });

  const updateServantMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServantPayload }) =>
      apiFetch<ServantRecord>(`/api/servants/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      closeModal();
    },
  });

  const deleteServantMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          apiFetch<{ success: true }>(`/api/servants/${id}`, {
            method: "DELETE",
          }),
        ),
      );
    },
    onSuccess: async (_, ids) => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      setSelectedServantIds((current) => current.filter((id) => !ids.includes(id)));
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ids, payload }: { ids: string[]; payload: UpdateServantPayload }) => {
      await Promise.all(
        ids.map((id) =>
          apiFetch<ServantRecord>(`/api/servants/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servants"] });
      setBulkAssignOpen(false);
      setBulkAssignForm({ gender: "", groupCode: "" });
      setSelectedServantIds([]);
    },
  });

  function openCreateModal() {
    setEditingServant(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEditModal(servant: ServantRecord) {
    setEditingServant(servant);
    setForm({
      name: servant.name,
      gender: servant.gender,
      group: servant.group,
      groupCode: servant.groupCode,
    });
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    startTransition(() => {
      setModalOpen(false);
      setEditingServant(null);
      setForm(EMPTY_FORM);
      setErrors({});
    });
  }

  function openBulkAssignModal() {
    if (selectedServantIds.length === 0) {
      return;
    }

    setBulkAssignForm({ gender: "", groupCode: "" });
    setBulkAssignOpen(true);
  }

  function closeBulkAssignModal() {
    setBulkAssignOpen(false);
    setBulkAssignForm({ gender: "", groupCode: "" });
  }

  function submitForm() {
    const nextErrors = validateServantForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      gender: form.gender ?? null,
      group: form.group ?? null,
      groupCode: form.groupCode ?? form.group ?? null,
    } satisfies CreateServantPayload;

    if (editingServant) {
      updateServantMutation.mutate({ id: editingServant.id, payload });
      return;
    }

    createServantMutation.mutate(payload);
  }

  function toggleServantSelection(servantId: string) {
    setSelectedServantIds((current) =>
      current.includes(servantId) ? current.filter((id) => id !== servantId) : [...current, servantId],
    );
  }

  async function deleteSelectedServants() {
    if (selectedServantIds.length === 0) {
      return;
    }

    if (!window.confirm(`Delete ${selectedServantIds.length} servant${selectedServantIds.length === 1 ? "" : "s"}?`)) {
      return;
    }

    await deleteServantMutation.mutateAsync(selectedServantIds);
  }

  async function applyBulkAssign() {
    const payload: UpdateServantPayload = {
      ...(bulkAssignForm.gender !== "" ? { gender: bulkAssignForm.gender === "null" ? null : bulkAssignForm.gender } : {}),
      ...(bulkAssignForm.groupCode !== ""
        ? {
            group: bulkAssignForm.groupCode === "null"
              ? null
              : (groupOptions.find((option) => option.value === bulkAssignForm.groupCode)?.legacyGroup ?? null),
            groupCode: bulkAssignForm.groupCode === "null" ? null : bulkAssignForm.groupCode,
          }
        : {}),
    };

    if (Object.keys(payload).length === 0) {
      return;
    }

    await bulkAssignMutation.mutateAsync({
      ids: selectedServantIds,
      payload,
    });
  }

  const servants = servantsQuery.data ?? [];
  const pending = createServantMutation.isPending || updateServantMutation.isPending;
  const showListSkeleton = servantsQuery.isLoading || servantsQuery.isFetching;
  const filtersActive = Boolean(search.trim() || groupFilter);

  return (
    <div className="min-h-full space-y-6 py-1 lg:px-2">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold leading-10 text-[var(--color-brand-ink)]">
            Teams
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)] md:text-base">
            Keep the servant roster ready for fast, accurate worship service assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="pressable inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-[var(--action-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--action-primary-ink)] sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add servant
        </button>
      </section>

      <section className="w-full">
        <div className="border-y border-[var(--rule-default)] py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                <UsersRound className="h-4 w-4 text-[var(--text-accent)]" />
                Team roster
              </h2>
              <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                {servants.length} {filtersActive ? "matching " : ""}servant{servants.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:justify-end">
              <label className="min-w-[220px] flex-1 sm:max-w-[280px]">
                <span className="sr-only">Search team</span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search servant name"
                    className="block min-h-10 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)]"
                />
                </span>
              </label>

              <div className="min-w-[180px] flex-1 sm:max-w-[220px]">
                <ProductionSelect
                  ariaLabel="Filter by group"
                  value={groupFilter}
                  onValueChange={setGroupFilter}
                  options={[
                    { value: "", label: "All groups" },
                    ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
                  ]}
                />
              </div>

              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setGroupFilter("");
                  }}
                  className="inline-flex min-h-10 items-center justify-center px-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Clear filters
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setSelectedServantIds([]);
                  void servantsQuery.refetch();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-panel-alt)] hover:text-[var(--text-primary)]"
                aria-label="Refresh servants"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>

              {selectedServantIds.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={openBulkAssignModal}
                    disabled={bulkAssignMutation.isPending}
                    className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50"
                  >
                    {bulkAssignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
                    Assign {selectedServantIds.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedServants()}
                    disabled={deleteServantMutation.isPending}
                    className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--state-danger)] px-3 text-sm font-semibold text-[var(--text-danger)] disabled:opacity-50"
                  >
                    {deleteServantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete {selectedServantIds.length}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {showListSkeleton ? (
          <TeamsListSkeleton />
        ) : servants.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <UsersRound className="h-8 w-8 text-[var(--text-muted)]" />
            <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">No matching servants</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
              Adjust your filters or add a servant to start building the directory.
            </p>
          </div>
        ) : (
          <div>
            <div
              aria-hidden="true"
              className="hidden grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(120px,.6fr)_minmax(140px,.75fr)_44px] items-center gap-3 border-b border-[var(--rule-default)] px-4 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] lg:grid"
            >
              <span />
              <span />
              <span>Servant</span>
              <span>Gender</span>
              <span>Group</span>
              <span />
            </div>
            <ul className="divide-y divide-[var(--rule-default)]">
              {servants.map((servant) => {
                const isSelected = selectedServantIds.includes(servant.id);
                const groupLabel = getGroupLabel(servant, groupOptions);

                return (
                  <li
                    key={servant.id}
                    className={
                      isSelected
                        ? "bg-[color:color-mix(in_srgb,var(--action-primary-bg)_8%,transparent)]"
                        : "bg-transparent"
                    }
                  >
                    <div className="grid grid-cols-[24px_40px_minmax(0,1fr)_44px] items-center gap-3 px-4 py-4 lg:grid-cols-[24px_40px_minmax(0,1.3fr)_minmax(120px,.6fr)_minmax(140px,.75fr)_44px]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleServantSelection(servant.id)}
                        aria-label={`Select ${servant.name}`}
                        className="ui-checkbox h-5 w-5"
                      />
                      <span
                        aria-hidden="true"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-sm font-semibold text-[var(--text-accent)]"
                      >
                        {getServantInitials(servant.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{servant.name}</p>
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)] lg:hidden">
                          {formatServantGenderLabel(servant.gender)} · {groupLabel}
                        </p>
                      </div>
                      <p className="hidden truncate text-sm text-[var(--text-secondary)] lg:block">
                        {formatServantGenderLabel(servant.gender)}
                      </p>
                      <span className="hidden w-fit max-w-full truncate rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] lg:block">
                        {groupLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(servant)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-panel-alt)]"
                        aria-label={`Edit ${servant.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {modalOpen ? (
        <ServantModal
          errors={errors}
          form={form}
          groupOptions={groupOptions}
          onChange={setForm}
          onClose={closeModal}
          onSubmit={submitForm}
          pending={pending}
          servant={editingServant}
        />
      ) : null}

      {bulkAssignOpen ? (
        <BulkAssignModal
          form={bulkAssignForm}
          groupOptions={groupOptions}
          onApply={() => void applyBulkAssign()}
          onChange={setBulkAssignForm}
          onClose={closeBulkAssignModal}
          pending={bulkAssignMutation.isPending}
          selectedCount={selectedServantIds.length}
        />
      ) : null}
    </div>
  );
}
